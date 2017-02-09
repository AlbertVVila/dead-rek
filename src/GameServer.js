const randomColor = require('randomcolor')
const {
  ACCEL,
  COIN_RADIUS,
  PLAYER_EDGE,
  SHOT_SPEED,
  SHOT_RADIUS,
  SHOT_DMG
} = require('./constants.js')

class GameServer {
  constructor (io) {
    this.players = {}
    this.coins = {}
    this.io = io
    this.nextCoinId = 0
    this.lastCoinSpawn = Date.now()

    for (let i = 0; i < 20; ++i) {
      const coin = {
        id: this.nextCoinId++,
        x: Math.random() * 2500,
        y: Math.random() * 1500
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
    var teams = ["ash.png","cat.png","drunk.jpg","Isee.jpg"]
    var randomIndex = Math.floor(Math.random()*teams.length)//poner length en ves de 4
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
      inputs,
      team : teams[randomIndex]
    }
    this.players[socket.id] = player

    socket.emit('world:init', this.players, this.coins, socket.id)

    // so that the new players appears on other people's screen
    this.onPlayerMoved(socket, inputs)
  }

  onPlayerMoved (socket, inputs) {
    //console.log(inputs)
    //console.log(`${new Date()}: ${socket.id} moved`)
    const player = this.players[socket.id]
    player.timestamp = Date.now()
    player.inputs = inputs
    this.io.sockets.emit('playerMoved', player)
  }

  onPlayerShoot(x,y,playerid){
    const player = this.players[playerid]
    console.log(player.score)
    if(player.score>0){
      //shoot
      const dx = x - player.x
      const dy = y - player.y
      const dtotal = Math.abs(dx)+Math.abs(dy)
      const shot = {
        sx: player.x,
        sy: player.y,
        vx: (dx/dtotal) * SHOT_SPEED,
        vy: (dy/dtotal) * SHOT_SPEED,
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
    for (let playerId in this.players) { //PLAYERS
      const player = this.players[playerId]
      const { inputs,shots } = player
      if (inputs.LEFT_ARROW) player.vx -= vInc
      if (inputs.RIGHT_ARROW) player.vx += vInc
      if (inputs.UP_ARROW) player.vy -= vInc
      if (inputs.DOWN_ARROW) player.vy += vInc

      player.x += player.vx * delta
      player.y += player.vy * delta
      player.x = player.x % 2500
      player.y = player.y % 1500

      for (let coinId in this.coins) { //COINS
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
          x: Math.random() * 2000,
          y: Math.random() * 1000
        }
        this.coins[coin.id] = coin
        this.lastCoinSpawn = Date.now()
        this.io.sockets.emit('coinSpawned', coin)
      }

      for(let shotid in shots){ //shots*players
         const shot = shots[shotid]
         shot.sx += shot.vx * delta
         shot.sy += shot.vy * delta
         for(let playerId2 in this.players){
           if(playerId2 == playerId) continue
            const player2 = this.players[playerId2]
            const dist = Math.abs(player2.x - shot.sx) + Math.abs(player2.y - shot.sy)
           const radiusSum = SHOT_RADIUS + (PLAYER_EDGE / 2)
           if(radiusSum > dist){
             delete this.players[playerId].shots[shotid]
             player.score+= SHOT_DMG
             player2.score-= SHOT_DMG
             this.io.sockets.emit('playerDMGD',player,player2)
           }
         
         }
      }
    }
  }
}

module.exports = GameServer