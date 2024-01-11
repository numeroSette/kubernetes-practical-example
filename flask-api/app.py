from flask import Flask, jsonify, redirect, request
import redis
import os

app = Flask(__name__)

redisCli = redis.Redis(
    host=os.environ.get('REDIS_HOST', 'localhost'),
    port=int(os.environ.get('REDIS_PORT', 6379)),
    decode_responses=True
    )

connection = redisCli.ping()
print(connection)

# Redis client configuration
redis_client = redis.StrictRedis(
    host=os.environ.get('REDIS_HOST', 'localhost'),
    port=int(os.environ.get('REDIS_PORT', 6379)),
    decode_responses=True
)

@app.route('/', methods=['GET'])
def list_keys():
    keys = redis_client.keys('*')
    return jsonify({"keys": keys, "message": "Returned from Python Flask API"}), 200

@app.route('/redis', methods=['GET'])
def get_data():
    key = request.args.get('key')
    if not key:
        return jsonify({"message": "Please provide a valid key. (Returned from Python Flask API)"}), 400

    value = redis_client.get(key)
    if value is None or value == '':
        return jsonify({"message": "Key not found or empty data. (Returned from Python Flask API)"}), 404

    return jsonify( { "data": { "key":key, "value": value }, "message": "Returned from Python Flask API" }), 200

@app.errorhandler(404)
def page_not_found(e):
    return redirect("/", code=302)