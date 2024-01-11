import swaggerAutogen from 'swagger-autogen';

const host = process.env.EXPRESS_API_HOSTNAME || 'localhost';
const port = process.env.EXPRESS_API_PORT || 3000;

const doc = {
  "openapi": "3.1.0",
  "info": {
      "title": "TypeScript, Express & Prisma REST API",
      "description": "This API provides a comprehensive example of integrating TypeScript, Express.js, and Prisma Client to create a robust RESTful API. It demonstrates CRUD operations on user and post entities, leveraging SQLite as the underlying database. The API showcases best practices in API development with TypeScript, including validation, error handling, and relational data management. It's an ideal starting point for developers looking to understand how to build scalable and maintainable APIs with these technologies.\n",
      "termsOfService": "http://swagger.io/terms/",
      "contact": {
          "email": "developer.sette@gmail.com"
      },
      "license": {
          "name": "Apache 2.0",
          "url": "http://www.apache.org/licenses/LICENSE-2.0.html"
      },
      "version": "1.0.11"
  },
  "externalDocs": {
      "description": "Learn more about Swagger Documentation",
      "url": "http://swagger.io"
  },
  "servers": [
    {
      "url": `http://${host}:${port}`
    }
  ],
  "tags": [
      {
          "name": "Users",
          "description": "Endpoints related to user management.",
          "externalDocs": {
              "description": "More about user management",
              "url": "http://swagger.io/users"
          }
      },
      {
          "name": "Posts",
          "description": "Handles all operations related to posts created by users.",
          "externalDocs": {
              "description": "Deep dive into posts management",
              "url": "http://swagger.io/posts"
          }
      },
      {
        "name": "Feed",
        "description": "Retrieve published posts based on criteria.",
        "externalDocs": {
            "description": "Deep dive into posts management",
            "url": "http://swagger.io/posts"
        }
    }      
  ],  
  "components": {
    "schemas": {
      "User": {
          "id": {
            "type": "integer",
            "format": "int64"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "name": {
            "type": "string"
          }
      },
      "Post": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "format": "int64"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "title": {
            "type": "string"
          },
          "content": {
            "type": "string"
          },
          "published": {
            "type": "boolean"
          },
          "viewCount": {
            "type": "integer"
          },
          "authorId": {
            "type": "integer"
          }
        }
      }    
    },
    "parameters": {
      "id": {
        "in": "path",
        "name": "id",
        "required": true,
        "schema": {
          "type": "integer",
          "format": "int64"
        },
        "description": "Unique identifier."
      },
      "searchString": {
        "in": "query",
        "name": "searchString",
        "schema": {
          "type": "string"
        },
        "description": "String to search in post titles and contents."
      },
      "skip": {
        "in": "query",
        "name": "skip",
        "schema": {
          "type": "integer"
        },
        "description": "Number of posts to skip for pagination."
      },
      "take": {
        "in": "query",
        "name": "take",
        "schema": {
          "type": "integer"
        },
        "description": "Number of posts to take for pagination."
      },
      "orderBy": {
        "in": "query",
        "name": "orderBy",
        "schema": {
          "type": "string",
          "enum": ["asc", "desc"]
        },
        "description": "Order by ascending or descending."
      }
    },     
  },
  "security": [
    {
      "bearerAuth": []
    }
  ]
};
const outputFile = './src/swagger.json';
const endpointsFiles = ['./src/index.ts'];

swaggerAutogen({openapi: '3.0.0'})(outputFile, endpointsFiles, doc);