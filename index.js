const express = require("express")
const server = express()

const { PORT = 3000 } = process.env

server.use(express.static(__dirname))

const accessToken = process.env.mapbox_token

server.listen(PORT, () => {
  console.log("I am listening...")
})