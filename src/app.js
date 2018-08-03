require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const morgan = require('morgan')
const app = express()
const mongoose = require('mongoose')
var Twitter = require('twitter')

// required scripts
const db = require('./db')

// data models
const User = require('../models/user')

app.use(morgan('combined'))
app.use(bodyParser.json())
app.use(cors())

    // mongoose.set('debug', true)

    // mongoose.connect(process.env.DB_HOST, {
    //     user: process.env.DB_USER,
    //     pass: process.env.DB_PASS,
    //     auth: { authdb: process.env.DB_AUTH },
    //     useNewUrlParser: true
    // })

    // var db = mongoose.connection
    // db.on('error', console.error.bind(console, 'connection error'))
    // db.once('open', function(callback) {
    //     console.log('MongoDB connection to ' + process.env.DB_HOST + ' succeeded')
    // })

    ; (async function() {
        try {
            await db.connect()
        } catch (error) {
            console.log('There was a problem with the database connection.')
            throw error
        }
    })();


function twitterConnect() {
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
    if (!req.query.screen_name) {
        res.send('You have to specify a Twitter username (screen_name).')
        return
    }
    // initiate Twitter
    var twitterClient = twitterConnect();

    // get up to date user data from Twitter, including ID
    try {
        var userTwitterDataActual = await twitterClient.get('users/show', { screen_name: req.query.screen_name }) // todo: what if tweet deleted?
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
        res.send(error)
        throw error
    }

    res.send(userTwitterDataActual)

})

app.get('/bookmarks', async (req, res) => {

    if (!req.query.screen_name) {
        res.send('You have to specify a Twitter username (screen_name).')
        return
    }

    // initiate Twitter
    var client = new Twitter({
        consumer_key: 'DP165fx618T9vWR7fabxeDtkO',
        consumer_secret: 'FMW8EXKdXeYChDzCMi1YGbnITrN0AbKu9yrHmUUOhRJ1uC4rc5',
        access_token_key: '1024288296116084736-XYnEPuyng0lT5VXoGego4Bphn3LGOJ',
        access_token_secret: 'Tu7fn2bk6YLFdfBkYpZAGA7zPiFQfFm4jVBXErNDh5NAZ'
    })

    // get up to date user data from Twitter, including ID
    try {
        var userTwitterDataActual = await client.get('users/show', { screen_name: req.query.screen_name }) // todo: what if tweet deleted?
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

    // console.log(fields);

    console.log(filter);

    User.findOne(filter)
        // .collation({
        //     locale: 'en_US',
        //     strength: 3
        // })
        .sort(sortQuery)
        .limit(4)
        .select('bookmarks')
        .lean()
        .exec(function(error, result) {
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
    var client = new Twitter({
        consumer_key: 'DP165fx618T9vWR7fabxeDtkO',
        consumer_secret: 'FMW8EXKdXeYChDzCMi1YGbnITrN0AbKu9yrHmUUOhRJ1uC4rc5',
        access_token_key: '1024288296116084736-XYnEPuyng0lT5VXoGego4Bphn3LGOJ',
        access_token_secret: 'Tu7fn2bk6YLFdfBkYpZAGA7zPiFQfFm4jVBXErNDh5NAZ'
    })

    // get up to date user data from Twitter, including ID
    try {
        var userTwitterDataActual = await client.get('users/show', { screen_name: req.query.screen_name }) // todo: what if tweet deleted?
    } catch (error) {
        res.send({ twitterError: error })
        throw error
    }

    // try {
    //     var user = await User.find({ "twitterUserData.id_str": userTwitterDataActual.id_str }).lean().exec()
    // } catch (error) {
    //     throw error
    // }

    // first check for new favorites, save in the database, then select from DB

    try {
        var favorites = await client.get('favorites/list', { screen_name: req.query.screen_name, count: 200 }) // todo: what if tweet deleted?
    } catch (error) {
        throw error
    }

    var favoritesIds = []
    favorites.forEach(favorite => {
        favoritesIds.push(favorite.id_str)
    });

    // save favorites IDs
    User.findOneAndUpdate({ id_str: userTwitterDataActual.id_str },
        {
            $set: { twitterUserData: userTwitterDataActual },
            $addToSet: { favorites: { $each: favoritesIds } }
        },
        { upsert: true, setDefaultsOnInsert: true, new: true }).exec(function(error, result) {
            if (error) {
                res.send(error)
                throw error
            }
        })

    // save full tweet details in DB
    // todo: this

    var filter = req.query.filter ? req.query.filter : {}
    var sortQuery = req.query.sort ? req.query.sort : {}

    console.log(req.query);

    if (filter.$and) {
        filter.$and.push({ 'id_str': userTwitterDataActual.id_str })
    } else {
        filter.$and = [{ 'id_str': userTwitterDataActual.id_str }]
    }

    // todo: do as aggregation to allow skipping? 
    User.findOne(filter)
        .sort(sortQuery)
        .limit(12)
        .select('favorites')
        .lean()
        .exec(function(error, result) {
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