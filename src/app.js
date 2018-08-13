require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const morgan = require('morgan')
const app = express()
var Twitter = require('twitter')

// required scripts
const db = require('./db')

// data models
const User = require('../models/user')

app.use(morgan('combined'))
app.use(bodyParser.json())
app.use(cors())

;(async function () {
  try {
    await db.connect()
  } catch (error) {
    console.log('There was a problem with the database connection.')
    throw error
  }
})()

function twitterConnect () {
  return new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  })
}

app.get('/', (req, res) => {
  res.send('Nothing here.')
})

app.get('/user', async (req, res) => {
  if (!req.query.screen_name && !req.query.user_id) {
    res.send('You have to specify a Twitter username (screen_name) or a Twitter ID (user_id).')
    return
  }
  // initiate Twitter
  var twitterClient = twitterConnect()

  // get up to date user data from Twitter, including ID

  if (req.query.screen_name) {
    var twOptions = { screen_name: req.query.screen_name }
  } else {
    twOptions = { user_id: req.query.user_id }
  }

  console.log(twOptions)
  try {
    var userTwitterDataActual = await twitterClient.get('users/show', twOptions) // todo: what if tweet deleted?
  } catch (error) {
    res.send({ twitterError: error })
    throw error
  }

  // save user data
  try {
    await db.update(User, {
      filter: { id_str: userTwitterDataActual.id_str },
      data: { twitterUserData: userTwitterDataActual }
    })
  } catch (e) {
    res.send(e)
    throw e
  }

  res.send(userTwitterDataActual)
})

app.get('/bookmarks', async (req, res) => {
  if (!req.query.screen_name) {
    res.send('You have to specify a Twitter username (screen_name).')
    return
  }

  // initiate Twitter
  var twitterClient = twitterConnect()

  // get up to date user data from Twitter, including ID
  try {
    var userTwitterDataActual = await twitterClient.get('users/show', { screen_name: req.query.screen_name }) // todo: what if tweet deleted?
  } catch (error) {
    res.send({ twitterError: error })
    throw error
  }

  var filter = req.query.filter ? req.query.filter : {}
  var fields = req.query.fields ? req.query.fields : {}
  var sortQuery = req.query.sort ? req.query.sort : {}

  // add user id_str to filter
  if (filter.$and) {
    filter.$and.push({ 'id_str': userTwitterDataActual.id_str })
  } else {
    filter.$and = [{ 'id_str': userTwitterDataActual.id_str }]
  }

  // todo: use querystring

  if (typeof fields === 'string') {
    var fieldsArray = fields.split(',')
    fields = {}
    for (const field of fieldsArray) {
      fields[field] = 1
    }
  }

  fields._id = false
  fields.__v = false

  User.findOne(filter)
    .sort(sortQuery)
    .limit(4)
    .select('bookmarks')
    .lean()
    .exec(function (error, result) {
      if (error) {
        res.send(error)
        throw error
      } else if (result) {
        res.send(result.bookmarks)
      }
    })
})

app.get('/favorites', async (req, res) => {
  if (!req.query.screen_name) {
    res.send('You have to specify a Twitter username (screen_name).')
    return
  }

  // initiate Twitter
  var twitterClient = twitterConnect()

  // get up to date user data from Twitter, including ID
  try {
    var userTwitterDataActual = await twitterClient.get('users/show', { screen_name: req.query.screen_name }) // todo: what if tweet deleted?
  } catch (error) {
    res.send({ twitterError: error }) // todo: make consistent on the front end
    throw error
  }

  // first check for new favorites, save in the database, then select from DB

  try {
    var favorites = await twitterClient.get('favorites/list', { screen_name: req.query.screen_name, count: 200 }) // todo: what if tweet deleted?
  } catch (error) {
    throw error
  }

  var favoritesIds = []
  favorites.forEach(favorite => {
    favoritesIds.push(favorite.id_str)
  })

  // save favorites IDs
  // todo: fix: this needs to be synchronous - need to wait for this before making the next db query
  User.findOneAndUpdate({ id_str: userTwitterDataActual.id_str },
    {
      $set: { twitterUserData: userTwitterDataActual },
      $addToSet: { favorites: { $each: favoritesIds } }
    },
    { upsert: true, setDefaultsOnInsert: true, new: true }).exec(function (error, result) {
    if (error) {
      res.send(error)
      throw error
    }
  })

  // save full tweet details in DB
  // todo: this

  var filter = req.query.filter ? req.query.filter : {}
  var sortQuery = req.query.sort ? req.query.sort : {}

  if (filter.$and) {
    filter.$and.push({ 'id_str': userTwitterDataActual.id_str })
  } else {
    filter.$and = [{ 'id_str': userTwitterDataActual.id_str }]
  }

  // todo: do as aggregation to allow skipping?
  User.findOne(filter)
    .sort(sortQuery)
    .select('favorites')
    .lean()
    .exec(function (error, result) {
      if (error) {
        res.send(error)
        throw error
      } else if (result) {
        res.send(result.favorites)
      }
    })
})

console.log('Server listening on port ' + (process.env.PORT || 8081))

app.listen(process.env.PORT || 8081)
