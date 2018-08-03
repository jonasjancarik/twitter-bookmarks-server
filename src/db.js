// dependencies
const _ = require('lodash')
const mongoose = require('mongoose')

function connect () {
  return new Promise(function (resolve, reject) {
    var tryCount = 1
    f(tryCount)
    function f (tryCount) {
      if (process.env.DB_USER && process.env.DB_PASS) {
        var mongoConnectionConfig = {
          user: process.env.DB_USER,
          pass: process.env.DB_PASS,
          auth: process.env.DB_AUTH,
          keepAlive: 1,
          connectTimeoutMS: 1000,
          useNewUrlParser: true
        }
      } else {
        mongoConnectionConfig = {}
        console.log('Warning: DB connection is anonymous, authentication should be configured')
      }
      var dbUrl = process.env.DB_HOST
      // var dbConnection = mongoose.createConnection(dbUrl, mongoConnectionConfig)
      var dbConnection = mongoose.connect(dbUrl, mongoConnectionConfig).then(
        () => {
          console.log('Database connection established.')
          resolve(dbConnection)
        },
        err => {
          // If first connect fails because mongod is down, try again later.
          // This is only needed for first connect, not for runtime reconnects.
          // See: https://github.com/Automattic/mongoose/issues/5169
          if (err.message && err.message.match(/failed to connect to server .* on first connect/)) {
          // if (attemptCount < 5) {
            console.log('An issue occured when connecting to the database (attempt number ' + tryCount + '): \n' + err.message)
            var retryTime = 3 * 1000
            console.log('Will retry in ' + retryTime / 1000 + (retryTime / 1000 === 1 ? ' second' : ' seconds'))

            // Wait for a bit, then try to connect again
            setTimeout(function () {
              debugger
              console.log('Retrying first connect, attempt number ' + ++tryCount)
              // dbConnection.openUri(dbUrl).catch(() => { })
              f(tryCount)
            }, retryTime)
          } else {
            // Some other error occurred.
            reject(Error(new Date() + String(err)))
          }
        }
      )
    }
  })
}

function find (model, options = {}) {
  return new Promise(function (resolve, reject) {
    model.find(options.filter).sort(options.sort).limit(options.limit).lean().select(options.fields).exec(function (err, doc) {
      if (err) {
        reject(err)
      } else if (doc) {
        resolve(doc)
      } else if (doc === null) {
        console.log('There are no ' + model + 's matching the filter ' + options.filter)
        // the Promise is still resolved - null needs to be handled by the consumer
        resolve(doc)
      }
    })
  })
}

// function update (model, filter, data, push = {}, upsert = true, setOnInsert = {}) {
function update (model, options = {}) {
  return new Promise(function (resolve, reject) {
    // Default options
    var optionsDefault = {
      setOnInsert: {},
      upsert: true
    }

    // apply defaults where options were not set
    Object.keys(optionsDefault).forEach(function (option) {
      if (!options[option]) {
        options[option] = optionsDefault[option]
      }
    })

    var query = {
      $set: options.data,
      $setOnInsert: options.setOnInsert
    }

    if (typeof options.push === 'object' || options.push === undefined) { // use lodash conforms
      if (options.push !== {} && options.push !== undefined) {
        query.$push = options.push
      }
    } else {
      console.log('Wrong type of "push"')
      console.log(typeof options.push)
      console.log(options.push)
    }
    debugger
    model.findOneAndUpdate(
      options.filter,
      query,
      { upsert: options.upsert, setDefaultsOnInsert: true, new: true }
    ).exec(function (err, doc) {
      if (err) {
        reject(err)
      } else if (!err) {
        // console.log('Saved details of ' + data.id);
        resolve(doc)
      } else {
        reject(err)
      }
    })
  })
}

function create (model, data) {
  return new Promise(function (resolve, reject) {
    model.create(data, function (err, doc) {
      if (!doc) {
        reject(Error('A problem occured when saving (insertOne) to the database.'))
      } else if (err) {
        debugger
        if (_.get(err, 'errors.id.kind') === 'unique') {
          resolve()
        }
        reject(err)
      } else {
        // console.log('Saved details of ' + data.id);
        debugger
        resolve(doc)
      }
    })
  })
}

function insertMany (model, data) {
  return new Promise(function (resolve, reject) {
    model.insertMany(data, function (error, docs) {
      if (error) {
        reject(Error('A problem occured when saving (insertMany) to the database. ' + error.message))
      } else if (!error) {
        resolve(docs)
      } else {
        reject(error)
      }
    })
  })
}

function disconnect () {
  // todo: check if necessary
  mongoose.disconnect()
  // mongoose.db.disconnect()
}

module.exports.find = find
module.exports.update = update
module.exports.create = create
module.exports.insertMany = insertMany
module.exports.connect = connect
module.exports.disconnect = disconnect
