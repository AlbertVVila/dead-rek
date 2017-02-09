// http://socket.io/get-started/chat/
const express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
const GameServer = require('./GameServer.js')


/*
// middleware   
app.use(function (req, res, next) {
    console.log(arguments)
    next()
})
*/

app.use(express.static('public'))


io.on('connection', function (socket) {
  game.onPlayerConnected(socket)

  // let lastPongTimestamp
  // let ping = 50
  socket.on('game:ping', () => {
    // lastPongTimestamp = Date.now()
    socket.emit('game:pong', Date.now())
  })
  socket.on('game:pung', () => {
    // ping = (Date.now() - lastPongTimestamp) / 2
  })
  socket.on('mouseclick',(x,y,playerid) => {
    game.onPlayerShoot(x,y,playerid)
  })
  socket.on('move', (inputs) => {
    game.onPlayerMoved(socket, inputs)
  })

  socket.on('disconnect', () => {
    game.onPlayerDisconnected(socket)
  })
})

const game = new GameServer(io)
let past = Date.now()
setInterval(function () {
  const now = Date.now()
  const delta = now - past
  past = now
  game.logic(delta)
}, 20)

http.listen(process.env.PORT || 3000, function () {
  console.log('listening on *:3000')
})