const randomColor = require('randomcolor')
const {
  ACCEL,
  COIN_RADIUS,
  PLAYER_EDGE
} = require('./constants.js')

class GameServer {
  constructor (io) {
    this.players = {}
    this.coins = {}
    this.io = io
    this.nextCoinId = 0
    this.lastCoinSpawn = Date.now()

    for (let i = 0; i < 10; ++i) {
      const coin = {
        id: this.nextCoinId++,
        x: Math.random() * 500,
        y: Math.random() * 500
      }
      this.coins[coin.id] = coin
    }
  }

  onPlayerConnected (socket) {
    console.log(`${socket.id} connected`)
    const inputs = {
      LEFT_ARROW: false,
      RIGHT_ARROW: false,
      UP_ARROW: false,
      DOWN_ARROW: false
    }
    
    const shots = {}
    const player = {
      x: Math.random() * 500,
      y: Math.random() * 500,
      vx: 0,
      vy: 0,
      color: randomColor(),
      id: socket.id,
      score: 0,
      shots,
      lastshotid:0,
      inputs
    }
    this.players[socket.id] = player

    socket.emit('world:init', this.players, this.coins, socket.id)

    // so that the new players appears on other people's screen
    this.onPlayerMoved(socket, inputs)
  }

  onPlayerMoved (socket, inputs) {
    console.log(inputs)
    console.log(`${new Date()}: ${socket.id} moved`)
    const player = this.players[socket.id]
    player.timestamp = Date.now()
    player.inputs = inputs
    this.io.sockets.emit('playerMoved', player)
  }

  onPlayerShoot(x,y,playerid){
    const player = this.players[playerid]
    if(player.score>0){
      //shoot
      const shot = {
        sx: x,
        sy: y
      }
      player.score--
      player.shots[player.lastshotid++] = shot
      this.io.sockets.emit('playerShooting',player)
    }
  }

  onPlayerDisconnected (socket) {
    console.log(`${socket.id} disconnected`)
    delete this.players[socket.id]
    socket.broadcast.emit('playerDisconnected', socket.id)
  }

  logic (delta) {
    const vInc = ACCEL * delta
    for (let playerId in this.players) {
      const player = this.players[playerId]
      const { inputs } = player
      if (inputs.LEFT_ARROW) player.vx -= vInc
      if (inputs.RIGHT_ARROW) player.vx += vInc
      if (inputs.UP_ARROW) player.vy -= vInc
      if (inputs.DOWN_ARROW) player.vy += vInc

      player.x += player.vx * delta
      player.y += player.vy * delta

      for (let coinId in this.coins) {
        const coin = this.coins[coinId]
        const dist = Math.abs(player.x - coin.x) + Math.abs(player.y - coin.y)
        const radiusSum = COIN_RADIUS + (PLAYER_EDGE / 2)
        if (radiusSum > dist) {
          delete this.coins[coinId]
          player.score++
          this.io.sockets.emit('coinCollected', player.id, coinId)
        }
      }

      if (Date.now() - this.lastCoinSpawn > 1000) {
        const coin = {
          id: this.nextCoinId++,
          x: Math.random() * 500,
          y: Math.random() * 500
        }
        this.coins[coin.id] = coin
        this.lastCoinSpawn = Date.now()
        this.io.sockets.emit('coinSpawned', coin)
      }
    }
  }
}

module.exports = GameServer