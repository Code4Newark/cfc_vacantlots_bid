const express = require("express")
var request = require("request")

const bodyParser = require("body-parser")
const jwt = require('jsonwebtoken')

const passport = require("passport")
const passportJWT = require("passport-jwt")

const ExtractJwt = passportJWT.ExtractJwt
const JwtStrategy = passportJWT.Strategy

const { User, Bid, AbandonedLot } = require("./models.js")

const bcrypt = require('bcryptjs')

//This uses the newark api to load the most recent abandoned properties and save them to database.
var url = "http://data.ci.newark.nj.us/api/action/datastore_search?resource_id=796e2a01-d459-4574-9a48-23805fe0c3e0"
request({
    url: url,
    json: true
}, function (error, response, body) {
    if (!error && response.statusCode === 200) {
        for (var i = 0; i <  body.result.records.length; i++){
            var record = body.result.records[i]
            var item = {
                _id: record['_id'],
                longitude: record.Longitude,
                latitude: record.Latitude,
                vitalStreetName: record['Vital Street Name'],
                vitalHouseNumber: record['Vital House Number'],
                ownerName: record['Owner Name'],
                ownerAddress: record['Owner Address'],
                classDesc: record['Class Desc'],
                zipcode: record['Zipcode'],
                netValue: record['NetValue'],
                lot: record['Lot'],
                block: record['Block'],
                cityState: record['City, State']
            }
            const abandonedLot = new AbandonedLot(item)
            abandonedLot.save()
        }
    }
})

//delete all users, only use if the database content doesn't matter
// User.remove({}, function(err,data) {
//   console.log('hereeeeeff', err, 'los', data)
// })

let jwtOptions = {}
jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeader()
jwtOptions.secretOrKey = 'tasmanianDevil'

const strategy = new JwtStrategy(jwtOptions, function(jwt_payload, next) {
  console.log('payload received', jwt_payload)

  User.findById(jwt_payload.id, function(err, user) {
    if (user) {
      next(null, user)
    } else {
      next(null, false)
    }
  })
})

passport.use(strategy)

const app = express()

app.use(bodyParser.json())

app.use(bodyParser.urlencoded({
  extended: true
}))

app.use(express.static('public'))

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + '/public/index.html')
})

app.get("/secret", passport.authenticate('jwt', { session: false }), function(req, res){
  res.json("Success! You cannot see this without a token")
})

app.get("/map",
  function (req, res) {
    AbandonedLot.find({}).exec(function (err, innerRes){
      res.json(innerRes)
    })
})

app.post("/login", function(req, res) {
  if(req.body.username && req.body.password){
    var username = req.body.username
    var password = req.body.password

    User.findOne({ username: username }, function(err, user) {
      if (err) {
        console.log(err)
      } else if (user) {
        if (bcrypt.compareSync(password, user.password)) {
          const payload = {id: user._id}
          const token = jwt.sign(payload, jwtOptions.secretOrKey)
          res.status(201).json({message: "ok", token: token})
        } else {
          res.status(401).json({message:"passwords did not match"})
        }
      } else {
        res.status(401).json({message:"no such user found"})
      }
    })
  } else {
    res.status(401).json({message:"incomplete login information"})
  }
})

app.post("/register", function(req, res) {
  if (req.body.name && req.body.username && req.body.password && req.body.email && req.body.phone) {
    var item = {
        name : req.body.name,
        username : req.body.username,
        password : req.body.password,
        email : req.body.email,
        phone : req.body.phone
        //check if dataCreated works/exists if you don't specify it here
      }
      User.findOne({ username: req.body.username }, 'username', function(err, user) {
        if (err) {
          console.log(err)
          res.status(500).json({message:err})
        } else if (user) {
          res.status(401).json({message:"username already in use"})
        } else {
          const salt = bcrypt.genSaltSync(10)

          item.password = bcrypt.hashSync(item.password, salt)
          const user = new User(item)
          user.save()
          res.status(201).json({message:"success"})
        }
      })
  } else {
    res.status(401).json({message:"incomplete registration information"})
  }
})

const port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Listening on port " + port)
})