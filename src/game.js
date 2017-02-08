/* globals requestAnimationFrame, io */
const kbd = require('@dasilvacontin/keyboard')
const randomColor = require('randomcolor')
const deepEqual = require('deep-equal')

document.addEventListener('keydown', function (event) {
    // event.preventDefault()
})

const socket = io()
const myPlayer = {
  x: 100,
  y: 100,
  vx: 0,
  vy: 0,
  inputs: {
    LEFT_ARROW: false,
    RIGHT_ARROW: false,
    UP_ARROW: false,
    DOWN_ARROW: false
  },
  color: randomColor()
}
let myPlayerId = null

// hash playerId => playerData

const ACCEL = 1 / 500

class GameClient {
  constructor () {
    this.players = {}
    this.coins = {}
  }

  onWorldInit (serverPlayers, coins) {
    this.players = serverPlayers
    this.coins = coins
  }

  onPlayerMoved (player) {
    //console.log(player)
    this.players[player.id] = player

    const delta = (Date.now() + clockDiff) - player.timestamp

        // increment position due to current velocity
        // and update our velocity accordingly
    player.x += player.vx * delta
    player.y += player.vy * delta

    const { inputs } = player
    if (inputs.LEFT_ARROW && !inputs.RIGHT_ARROW) {
      player.x -= ACCEL * Math.pow(delta, 2) / 2
      player.vx -= ACCEL * delta
    } else if (!inputs.LEFT_ARROW && inputs.RIGHT_ARROW) {
      player.x += ACCEL * Math.pow(delta, 2) / 2
      player.vx += ACCEL * delta
    }
    if (inputs.UP_ARROW && !inputs.DOWN_ARROW) {
      player.y -= ACCEL * Math.pow(delta, 2) / 2
      player.vy -= ACCEL * delta
    } else if (!inputs.UP_ARROW && inputs.DOWN_ARROW) {
      player.y += ACCEL * Math.pow(delta, 2) / 2
      player.vy += ACCEL * delta
    }
  }

  onPlayerDisconnected (playerId) {
    delete this.players[playerId]
  }

  MovePlayers(delta){
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
    }
  }

  CoinColliding(ccol){
    const{x,y,points} = ccol
    let player = this.players[myPlayerId]
   return Math.sqrt(Math.pow(Math.abs(x-player.x),2)+Math.pow(Math.abs(y-player.y),2)) <= 60
  }

  CheckCollisions(delta){
    for(let coinID in this.coins){
       //l'ideal seria tenir variables mida en ves de utilitzar valors magics
      if(!this.CoinColliding(this.coins[coinID])) continue
      console.log("collision detected")
      socket.emit('coincolliding',coinID)

    }
  }
  logic (delta) {
    this.MovePlayers(delta)
    this.CheckCollisions(delta)
  }
}
const game = new GameClient()

function updateInputs () {
  const { inputs } = myPlayer
  const oldInputs = Object.assign({}, inputs)

  for (let key in inputs) {
    inputs[key] = kbd.isKeyDown(kbd[key])
  }

  if (!deepEqual(myPlayer.inputs, oldInputs)) {
    socket.emit('move', myPlayer.inputs)
  }
}

const canvas = document.createElement('canvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
document.body.appendChild(canvas)

const ctx = canvas.getContext('2d')

function RenderPlayers()
{
    for (let playerId in game.players) {
    const { color, x, y } = game.players[playerId]
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x,y,40,0,2*Math.PI)
    ctx.fill()
    //ctx.fillRect(x, y, 50, 50)
    if (playerId === myPlayerId) {
      ctx.stroke()
    }
  }
}

function RenderCoins(){
  for (let coinId in game.coins){
    const {x,y,points} = game.coins[coinId]
    ctx.fillStyle = randomColor()
    ctx.fillRect(x,y,20,20)
  }
}

function gameRenderer (game) {
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)
  RenderPlayers()
  RenderCoins()

}

let past = Date.now()
function gameloop () {
  requestAnimationFrame(gameloop)

  const now = Date.now()
  const delta = now - past
  past = now

  updateInputs()
  game.logic(delta)
  gameRenderer(game)
}

let lastPingTimestamp
let clockDiff = 0 // how many ms the server is ahead from us
let ping = Infinity

function startPingHandshake () {
  lastPingTimestamp = Date.now()
  socket.emit('game:ping')
}
setInterval(startPingHandshake, 250)

socket.on('connect', function () {
  socket.on('world:init', function (serverPlayers,coins, myId) {
    game.onWorldInit(serverPlayers,coins)
    myPlayerId = myId
  })
  socket.on('playerMoved', game.onPlayerMoved.bind(game))
  socket.on('playerDisconnected', game.onPlayerDisconnected.bind(game))

  socket.on('game:pong', (serverNow) => {
    ping = (Date.now() - lastPingTimestamp) / 2
    clockDiff = (serverNow + ping) - Date.now()
  //  console.log({ ping, clockDiff })
  })
})

requestAnimationFrame(gameloop)