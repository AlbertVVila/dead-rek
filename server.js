// http://socket.io/get-started/chat/
const express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

/*
// middleware
app.use(function (req, res, next) {
    console.log(arguments)
    next()
})
*/

const players = {}

app.use(express.static('public'))

io.on('connection', function (socket) {
  console.log(`${socket.id} connected`)

  socket.emit('world:init', players, socket.id)

  let lastPongTimestamp
  let ping = 50
  socket.on('game:ping', () => {
    lastPongTimestamp = Date.now()
    socket.emit('game:pong', Date.now())
  })

  socket.on('move', function (player) {
      console.log(`${new Date()}: ${socket.id} moved`)
      player.timestamp = Date.now() - ping
      players[socket.id] = player
      player.id = socket.id
      socket.broadcast.emit('playerMoved', player)
  })

  socket.on('game:pung', () => {
    ping = (Date.now() - lastPongTimestamp) / 2
  })

  socket.on('disconnect', function () {
    console.log(`${socket.id} disconnected`)
    delete players[socket.id]
    socket.broadcast.emit('playerDisconnected', socket.id)
  })
})

http.listen(process.env.PORT || 3000, function(){
  console.log('listening on *:3000');
});