var mongoose = require('mongoose')
var MongooseUniqueValidator = require('mongoose-unique-validator')

var Schema = mongoose.Schema

var schema = new Schema({
  id_str: { type: String, required: true, unique: true }
}, { strict: false })

schema.plugin(MongooseUniqueValidator)

module.exports = mongoose.model('User', schema)
