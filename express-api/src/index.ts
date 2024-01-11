import { Prisma, PrismaClient } from '@prisma/client'
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { Result, checkExact, validationResult, checkSchema } from 'express-validator';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { Pool, DatabaseError } from 'pg';
import { Redis } from 'ioredis';
import axios, { AxiosError } from 'axios'
import dotenv from 'dotenv';

dotenv.config();

console.log(process.env)

const prisma = new PrismaClient()

const app : express.Application = express()

const host = process.env.EXPRESS_API_HOSTNAME || 'localhost';
const port = process.env.EXPRESS_API_PORT || 3000;




app.use(express.json({ strict: false }));


const errorFactory = (err: any, res: express.Response, customMessage?: Object) => {

  return {
    error: {
      errors: err,
      code: res.statusCode,
      message: customMessage || "Unknown Error"
    }
  }

}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {

  if (err instanceof SyntaxError) {
    return res.status(400).json(errorFactory(err, res, "Malformed JSON"));
  }

  next(err);

});




const validateSignup = (): express.RequestHandler[] => [
  checkExact(
    checkSchema({
      name: {
        errorMessage: 'The name field must be a String',
        isString: true,
      },
      email: {
        errorMessage: 'The email field must be a Valid E-mail',
        isEmail: true,
      },
      posts: {
        isArray: {
          options: { min: 1 },
          errorMessage: 'The posts field value must be an Array that contains at least 1 JSON object',
        },
        custom: {
          options: (posts) => {
            const allowedKeys = ['title', 'content'];
            for (const post of posts) {
              const keys = Object.keys(post);
              if (!keys.every(key => allowedKeys.includes(key)) || keys.length !== allowedKeys.length) {
                return false;
              }
              if (typeof post.title !== 'string' || typeof post.content !== 'string') {
                return false;
              }
            }
            return true;
          },
          errorMessage: 'Each array object must contain only title and content keys with string values',
        },
      }
    }),
    {
      locations: ['body']
    }
  )

];

const validatePost = (): express.RequestHandler[] => [
  checkExact(
    checkSchema({
      title: {
        errorMessage: 'The title field must be a String',
        isString: true,
      },
      content: {
        errorMessage: 'The content field must be a String',
        isString: true,
      },
      authorEmail: {
        errorMessage: 'The authorEmail field must be a Valid E-mail',
        isEmail: true
      }
    }),
    {
      locations: ['body']
    }
  )

];

const validateRequestById = (): express.RequestHandler[] => [
  checkExact(
    checkSchema({
      id: {
        matches: {
          options: /^[1-9]\d*$/,
          errorMessage: 'Must be a valid ID'
        }
      }
    }),
    {
      locations: ['params']
    }
  )

];

const searchFeedValidation = (): express.RequestHandler[] => [
  checkExact(
    checkSchema({
      searchString: {
        optional: true
      },
      skip: {
        optional: true
      },
      take: {
        optional: true
      },
      orderBy: {
        optional: true,
        isIn: {
          options: [['asc', 'desc']],
          errorMessage: 'Sort order must be either "asc" or "desc"'
        }
      },
    }),
    {
      locations: ['query']
    }
  )

];

export const createValidationMiddleware = (validationRules: express.RequestHandler[]): express.RequestHandler[] => {
  return [
    ...validationRules,
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(errors);
      }
      return next();
    }
  ];
};



app.post(`/signup`, createValidationMiddleware(validateSignup()), async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Users']
    #swagger.summary = 'Create a new user'
    #swagger.description = 'Endpoint to create a new user. The user must have a name and an email, along with an optional list of posts.'
    #swagger.requestBody = {
        required: true,
        content: {
            "application/json": {
                schema: {
                    $ref: "#/components/schemas/User"
                },
                example: {
                    name: "Sette",
                    email: "numero@sette.io",
                    posts: [
                      { title: "First Post", content: "Content of the first post" },
                      { title: "Second Post", content: "Content of the second post" }
                    ]
                }
            }
        }
    }
    #swagger.responses[201] = { description: "User created successfully." }
    #swagger.responses[400] = { description: "Malformed JSON or invalid data." }
    #swagger.responses[422] = { description: "Validation error." }
    #swagger.responses[500] = { description: "Generic server error." }
  */

  try {

    const { name, email, posts } = req.body

    const postData = posts?.map((post: Prisma.PostCreateInput) => {
      return { title: post?.title, content: post?.content }

    })

    const result = await prisma.user.create({
      data: {
        name,
        email,
        posts: {
          create: postData,
        },
      },
    })

    res.statusCode = 201;
    return res.json(result);

  } catch (err: any) {
    next(err);
  }

})

app.get('/users', async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Users']
    #swagger.summary = 'Get all users'
    #swagger.description = 'Endpoint to retrieve all users from the database.'
    #swagger.responses[200] = { description: "List of users retrieved successfully." }
    #swagger.responses[500] = { description: "Generic server error." }
  */

  try {
    const users = await prisma.user.findMany()
  
    res.statusCode = 200;
    return res.json(users)

  } catch (error) {
    next(error)
  }

})

app.get('/user/:id/drafts', createValidationMiddleware(validateRequestById()), async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Users']
    #swagger.summary = 'Get drafts by a user'
    #swagger.description = 'Endpoint to retrieve all draft posts created by a specific user.'
    #swagger.parameters['$ref'] = ['#/components/parameters/id']
    #swagger.responses[200] = { description: "List of draft posts retrieved successfully." }
    #swagger.responses[404] = { description: "User not found." }
    #swagger.responses[500] = { description: "Generic server error." }
  */

  try {

    const { id } = req.params

    const drafts = await prisma.user
      .findUnique({
        where: {
          id: Number(id),
        },
      })
      .posts({
        where: { published: false },
      })

    res.statusCode = 200;
    return res.json(drafts)

  } catch (error) {
    next(error)
  }

})

app.post(`/post`, createValidationMiddleware(validatePost()), async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Posts']
    #swagger.summary = 'Create a new post'
    #swagger.description = 'Endpoint to create a new post. The post requires a title, content, and the author email.'
    #swagger.requestBody = {
        required: true,
        content: {
            "application/json": {
                schema: {
                    $ref: "#/components/schemas/Post"
                },
                example: {
                  title: "New Post Title",
                  content: "The content of the new post",
                  authorEmail: "numero@sette.io"
                }
            }
        }
    }
    #swagger.responses[201] = { description: "Post created successfully." }
    #swagger.responses[400] = { description: "Malformed JSON or invalid data." }
    #swagger.responses[422] = { description: "Validation error." }
    #swagger.responses[500] = { description: "Generic server error." }
  */

  try {

    const { title, content, authorEmail } = req.body

    const result = await prisma.post.create({
      data: {
        title,
        content,
        author: { connect: { email: authorEmail } },
      },
    })

    res.statusCode = 201;
    return res.json(result);

  } catch (err: any) {
    next(err);
  }

})

app.get(`/post/:id`, createValidationMiddleware(validateRequestById()), async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Posts']
    #swagger.summary = 'Retrieve a specific post'
    #swagger.description = 'Endpoint to retrieve a specific post by its ID.'
    #swagger.parameters['$ref'] = ['#/components/parameters/id']
    #swagger.responses[200] = { description: "Post retrieved successfully." }
    #swagger.responses[404] = { description: "Post not found." }
    #swagger.responses[500] = { description: "Generic server error." }
  */

  try {

    const { id }: { id?: string } = req.params

    const post = await prisma.post.findUnique({
      where: { id: Number(id) },
    })

    res.statusCode = 200;
    return res.json(post)

  } catch (error) {
    next(error)
  }

})

app.put('/publish/:id', createValidationMiddleware(validateRequestById()), async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Posts']
    #swagger.summary = 'Publish a post'
    #swagger.description = 'Endpoint to publish or unpublish a post identified by its ID.'
    #swagger.parameters['$ref'] = ['#/components/parameters/id']
    #swagger.responses[200] = { description: "Post publish status updated successfully." }
    #swagger.responses[404] = { description: "Post not found." }
    #swagger.responses[500] = { description: "Generic server error." }
  */

  try {

    const { id } = req.params

    const postData = await prisma.post.findUnique({
      where: { id: Number(id) },
      select: {
        published: true,
      },
    })

    const updatedPost = await prisma.post.update({
      where: { id: Number(id) || undefined },
      data: { published: !postData?.published },
    })

    res.statusCode = 201;
    return res.json(updatedPost)

  } catch (error) {
    next(error)
  }
})

app.patch('/post/:id/views', createValidationMiddleware(validateRequestById()), async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Posts']
    #swagger.summary = 'Update post view count'
    #swagger.description = 'Endpoint to increment the view count of a post identified by its ID.'
    #swagger.parameters['$ref'] = ['#/components/parameters/id']
    #swagger.responses[200] = { description: "Post view count updated successfully." }
    #swagger.responses[404] = { description: "Post not found." }
    #swagger.responses[500] = { description: "Generic server error." }
  */

  try {

    const { id } = req.params

    const post = await prisma.post.update({
      where: { id: Number(id) },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

    res.statusCode = 200;
    res.json(post)

  } catch (error) {
    next(error)
  }
})

app.get('/feed', createValidationMiddleware(searchFeedValidation()), async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Feed']
    #swagger.summary = 'Search in the feed'
    #swagger.description = 'Endpoint to search for posts in the feed based on optional search parameters.'
    #swagger.parameters['$ref'] = [
      '#/components/parameters/searchString',
      '#/components/parameters/skip',
      '#/components/parameters/take',
      '#/components/parameters/orderBy',                
    ]
    #swagger.responses[200] = { description: "Search results returned successfully." }
    #swagger.responses[400] = { description: "Invalid query parameters." }
    #swagger.responses[500] = { description: "Generic server error." }
  */ 

  try {

    const { searchString, skip, take, orderBy } = req.query

    const or: Prisma.PostWhereInput = searchString
      ? {
        OR: [
          { title: { contains: searchString as string } },
          { content: { contains: searchString as string } },
        ],
      }
      : {}

    const posts = await prisma.post.findMany({
      where: {
        published: true,
        ...or,
      },
      include: { author: true },
      take: Number(take) || undefined,
      skip: Number(skip) || undefined,
      orderBy: {
        updatedAt: orderBy as Prisma.SortOrder,
      },
    })

    res.statusCode = 200;
    return res.json(posts)

  } catch (error) {
    next(error)
  }

})

app.delete(`/post/:id`, createValidationMiddleware(validateRequestById()), async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Posts']
    #swagger.summary = 'Delete a post'
    #swagger.description = 'Endpoint to delete a specific post identified by its ID.'
    #swagger.parameters['$ref'] = ['#/components/parameters/id']
    #swagger.responses[200] = { description: "Post deleted successfully." }
    #swagger.responses[404] = { description: "Post not found." }
    #swagger.responses[500] = { description: "Generic server error." }
  */
  
  try {

    const { id } = req.params

    const post = await prisma.post.delete({
      where: {
        id: Number(id),
      },
    })

    res.statusCode = 200;
    return res.json(post)

  } catch (error) {
    next(error)
  }

})



app.get('/external-api/redis/keys', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  /* 
    #swagger.tags = ['External Redis']
    #swagger.summary = 'List keys in Redis via external Python API'
    #swagger.description = 'Lists all keys stored in Redis using an external Python API.'
    #swagger.responses[200] = { description: "Keys listed successfully from Redis." }
    #swagger.responses[500] = { description: "Error listing keys from Redis." }
  */
  try {
    const response = await axios.get(`${process.env.REDIS_API_URL}`);
    res.json(response.data);
  } catch (error) {
    res.statusCode = res.statusCode || 500;
    next(error)
  }
});

app.get('/external-api/redis/:key', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  /* 
    #swagger.tags = ['External Redis']
    #swagger.summary = 'Get a key from Redis via external Python API'
    #swagger.description = 'Retrieves the value of a specified key from Redis using an external Python API.'
    #swagger.parameters['key'] = {
        in: 'path',
        required: true,
        type: 'string',
        description: 'The key to retrieve the value for'
    }
    #swagger.responses[200] = { description: "Value retrieved successfully from Redis." }
    #swagger.responses[500] = { description: "Error retrieving value from Redis." }
  */
  try {
    const { key } = req.params;
    const response = await axios.get(`${process.env.REDIS_API_URL}/redis?key=${key}`);
    res.json(response.data);
  } catch (error) {
    res.statusCode = res.statusCode || 500;
    next(error)
  }
});




app.get('/redis/keys', async (req: express.Request, res: express.Response, next: express.NextFunction) => {

  /* 
    #swagger.tags = ['Redis']
    #swagger.summary = 'List keys in Redis'
    #swagger.description = 'Lists all keys stored in Redis.'
    #swagger.responses[200] = { description: "Keys listed successfully." }
    #swagger.responses[500] = { description: "Error listing keys in Redis." }
  */

  try {
    const redis = new Redis(`${process.env.REDIS_URL}`);    
    const keys = await redis.keys('*');
    res.status(200).json(keys);
  } catch (error) {
    res.status(500).send('Error listing keys in Redis.');
  }
  
});

app.get('/redis/get/:key', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  /* 
    #swagger.tags = ['Redis']
    #swagger.summary = 'Get a value from Redis'
    #swagger.description = 'Retrieves the value associated with a given key from Redis.'
    #swagger.parameters['key'] = {
        in: 'path',
        required: true,
        type: 'string',
        description: 'The key to retrieve the value for'
    }
    #swagger.responses[200] = { description: "Value retrieved from Redis successfully." }
    #swagger.responses[404] = { description: "Key not found in Redis." }
    #swagger.responses[500] = { description: "Error retrieving value from Redis." }
  */

  try {

    const redis = new Redis(`${process.env.REDIS_URL}`);
  
    const { key } = req.params;    

    const value = await redis.get(key);
    if (value !== null) {
      res.status(200).send(value);
    } else {
      res.status(404).send('Key not found.');
    }
  } catch (error) {
    res.status(500).send('Error retrieving value from Redis.');
  }

});

app.post('/redis/set', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  /* 
    #swagger.tags = ['Redis']
    #swagger.summary = 'Set a value in Redis'
    #swagger.description = 'Stores a key-value pair in Redis.'
    #swagger.requestBody = {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: 'object',
                    properties: {
                        key: { type: 'string' },
                        value: { type: 'string' }
                    },
                    required: ['key', 'value']
                },
                example: { key: "sampleKey", value: "sampleValue" }
            }
        }
    }
    #swagger.responses[200] = { description: "Value stored in Redis successfully." }
    #swagger.responses[500] = { description: "Error storing value in Redis." }
  */

  try {
    const redis = new Redis(`${process.env.REDIS_URL}`);

    const { key, value } = req.body;
    await redis.set(key, value);
    res.status(200).send('Value stored successfully.');
  } catch (error) {
    res.status(500).send('Error storing value in Redis.');
  }
});

app.delete('/redis/delete/:key', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  /* 
    #swagger.tags = ['Redis']
    #swagger.summary = 'Delete a key from Redis'
    #swagger.description = 'Deletes a specified key from Redis.'
    #swagger.parameters['key'] = {
        in: 'path',
        required: true,
        type: 'string',
        description: 'The key to delete'
    }
    #swagger.responses[200] = { description: "Key deleted successfully from Redis." }
    #swagger.responses[404] = { description: "Key not found in Redis." }
    #swagger.responses[500] = { description: "Error deleting key from Redis." }
  */
  
  try {

    const redis = new Redis(`${process.env.REDIS_URL}`);
  
    const { key } = req.params;

    const result = await redis.del(key);
    if (result === 1) {
      res.status(200).send('Key deleted successfully.');
    } else {
      res.status(404).send('Key not found.');
    }
  } catch (error) {
    res.statusCode = 500;
    next(error)
  }
});




app.get('/postgres/time', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  /* 
    #swagger.tags = ['PostgreSQL']
    #swagger.summary = 'Get current time from PostgreSQL'
    #swagger.description = 'Retrieves the current time from the PostgreSQL database.'
    #swagger.responses[200] = { description: "Current time retrieved from PostgreSQL successfully." }
    #swagger.responses[500] = { description: "Error retrieving time from PostgreSQL." }
  */
    
  try {

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    const { rows } = await pool.query('SELECT NOW()');
    res.status(200).json(rows);
  } catch (error) {
    res.statusCode = 500;
    next(error)
  }

});




app.head('/alive', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  /* 
    #swagger.tags = ['Service']
    #swagger.summary = 'Head of Example Endpoint'
    #swagger.description = 'Retrieves the headers of the Example endpoint response identical to those of a GET request, but without the response body.'
    #swagger.responses[200] = { 
      description: "Headers of the Example endpoint successfully retrieved." 
    }
  */
  // Implementação fictícia apenas para enviar headers
  res.header('Content-Type', 'application/json');
  res.status(200).end();
});

app.options('/methods', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  /* 
    #swagger.tags = ['Service']
    #swagger.summary = 'Options for Example Endpoint'
    #swagger.description = 'Provides communication options for the Example endpoint.'
    #swagger.responses[200] = { 
      description: "Successful response indicating the available HTTP methods for the Example endpoint." 
    }
  */
  res.header('Allow', 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PATH');
  res.send();
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {

  if (err instanceof Result) {
    res.statusCode = 422;
    err = errorFactory(err, res, "Validation Error");
  }

  if (err instanceof PrismaClientKnownRequestError) {

    res.statusCode = 422;

    if (err.code == 'P2025') {
      res.statusCode = 404;
    }

    err = errorFactory(err, res, {"action":`https://www.prisma.io/docs/orm/reference/error-reference#${err.code}`})
  }

  if (err instanceof PrismaClientValidationError) {
    res.statusCode = 422;
    err = errorFactory(err, res, {"action":"https://www.prisma.io/docs/orm/reference/error-reference#prismaclientvalidationerror"})
  }


  if(err instanceof DatabaseError){
    res.statusCode = 500
    err = errorFactory(err, res, {"cause": err.message, "action": "https://www.postgresql.org/docs/current/errcodes-appendix.html"})
  }
  
  if(err instanceof AxiosError){
    res.statusCode = err.response?.status || 500;
    err = errorFactory(err, res, {"cause": err.message})
  }

  res.statusCode = res.statusCode || 500;
  return res.json(err);

});




const swaggerOutput = require('./swagger.json')

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerOutput))

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.redirect('/docs');
});

app.listen(port, () => {
  console.log(`🚀 Server ready at: http://${host}:${port}`);
  console.log('⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api\n');
});
