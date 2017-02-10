/* globals requestAnimationFrame, io */
const kbd = require('@dasilvacontin/keyboard')
const deepEqual = require('deep-equal')
const { ACCEL, COIN_RADIUS, PLAYER_EDGE, SHOT_RADIUS, SCREEN_SIZEX, SCREEN_SIZEY } = require('./constants.js')
const socket = io()

let myPlayerId = null
const myInputs = {
  LEFT_ARROW: false,
  RIGHT_ARROW: false,
  UP_ARROW: false,
  DOWN_ARROW: false
}

class GameClient {
  constructor () {
    this.players = {}
    this.coins = {}
    this.teams = {}
  }

  onWorldInit (serverPlayers, serverCoins, teams) {
    this.players = serverPlayers
    this.coins = serverCoins
    this.teams = teams
  }

  onPlayerMoved (player) {
    console.log(player)
    this.players[player.id] = player

    const delta = (lastLogic + clockDiff) - player.timestamp

        // increment position due to current velocity
        // and update our velocity accordingly
    player.x += player.vx * delta
    player.y += player.vy * delta

    const { inputs } = player
    if (inputs.LEFT_ARROW && !inputs.RIGHT_ARROW) {
      if(player.x <= SCREEN_SIZEX && player.x>=0 ){
        player.x -= ACCEL * Math.pow(delta, 2) / 2
        player.vx -= ACCEL * delta
      }
    }else if (!inputs.LEFT_ARROW && inputs.RIGHT_ARROW) {
      if(player.x<= SCREEN_SIZEX && player.x>=0 ){
      player.x += ACCEL * Math.pow(delta, 2) / 2
      player.vx += ACCEL * delta
      }
    }
    if (inputs.UP_ARROW && !inputs.DOWN_ARROW) {
      if(player.y <= SCREEN_SIZEY && player.y>=0 ){
        player.y -= ACCEL * Math.pow(delta, 2) / 2
        player.vy -= ACCEL * delta
      }
    } else if (!inputs.UP_ARROW && inputs.DOWN_ARROW) {
      if(player.y<= SCREEN_SIZEY && player.y>=0 ){
      player.y += ACCEL * Math.pow(delta, 2) / 2
      player.vy += ACCEL * delta
      }
    }
    if(player.x > SCREEN_SIZEX) {
      player.x = SCREEN_SIZEX
      player.vx = 0;
    }
    if(player.x < 0) {
      player.x = 0
      player.vx = 0;
    }
    if(player.y > SCREEN_SIZEY) {
      player.y = SCREEN_SIZEY
      player.vy = 0;
    }
    if(player.y < 0) {
      player.y = 0
      player.vy = 0;
    }
  }


  onPlayerShoot(player){
    this.players[player.id] = player
  }

  onPlayerDMGD(player,player2){
    this.players[player.id]= player
    this.players[player2.id] = player2
  }
  onCoinSpawned (coin) {
    this.coins[coin.id] = coin
  }

  onCoinCollected (playerId, coinId) {
    delete this.coins[coinId]
    const player = this.players[playerId]
    player.score++
    this.teams[player.teamid].score++
  }

  onUpdateScore(teams){
    this.teams=teams
  }
  onPlayerDisconnected (playerId) {
    delete this.players[playerId]
  }

  logic (delta) {
    const vInc = ACCEL * delta
    for (let playerId in this.players) {
      const player = this.players[playerId]
      const { inputs,shots} = player
      if (inputs.LEFT_ARROW) player.vx -= vInc
      if (inputs.RIGHT_ARROW) player.vx += vInc
      if (inputs.UP_ARROW) player.vy -= vInc
      if (inputs.DOWN_ARROW) player.vy += vInc
      if(player.x <= SCREEN_SIZEX && player.x>=0 ){
      player.x += player.vx * delta
      }
      if(player.y <= SCREEN_SIZEY && player.y>=0 ){
      player.y += player.vy * delta}
      
      if(player.x >= SCREEN_SIZEX){
        player.x = SCREEN_SIZEX
        player.vx = 0
      }
      if(player.y >= SCREEN_SIZEY){
         player.y = SCREEN_SIZEY
         player.vy = 0 
      } 
      if(player.x <0){
         player.x = 0
         player.vx = 0 
      } 
      if(player.y <0){
          player.y = 0
          player.vy = 0
      }  
      
      
      for(let shotid in shots){
         const shot = shots[shotid]
         shot.sx += shot.vx * delta
         shot.sy += shot.vy * delta
      }
    }
  }
}


const game = new GameClient()

function updateInputs () {
  const oldInputs = Object.assign({}, myInputs)

  for (let key in myInputs) {
    myInputs[key] = kbd.isKeyDown(kbd[key])
  }

  if (!deepEqual(myInputs, oldInputs)) {
    socket.emit('move', myInputs)

    // update our local player' inputs aproximately when the server
    // takes them into account
    const frozenInputs = Object.assign({}, myInputs)
    setTimeout(function () {
      const myPlayer = game.players[myPlayerId]
      myPlayer.inputs = frozenInputs
    }, ping)
  }
}



const canvas = document.createElement('canvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')
var img = new Image()
img.src = "pokeball.PNG"
var playerimg = new Image()
document.addEventListener('click', (event) => {
  console.log("mousex :"+event.pageX+" mousey: "+event.pageY)
    socket.emit('mouseclick',event.pageX,event.pageY,myPlayerId)
})


function gameRenderer (game) {
 // bg
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)
    
    //coins
  for (let coinId in game.coins) {
    const coin = game.coins[coinId]
   /* ctx.fillStyle = 'yellow'
    ctx.beginPath()
    ctx.arc(coin.x, coin.y, COIN_RADIUS, 0, 2 * Math.PI)
    ctx.fill() */
    ctx.drawImage(img,coin.x,coin.y,COIN_RADIUS,COIN_RADIUS)
  }
  //players
  for (let playerId in game.players) {
    
    const { color, x, y, score, shots, team, teamid } = game.players[playerId]
    console.log(game.players[myPlayerId].teamid+" sees "+teamid)
    ctx.save()
    ctx.translate(x, y)
    //ctx.fillStyle = color
    const HALF_EDGE = PLAYER_EDGE / 2
    playerimg.src = team
    console.log("playerseen image "+team)
    ctx.drawImage(playerimg,-HALF_EDGE, -HALF_EDGE, PLAYER_EDGE, PLAYER_EDGE)
    //ctx.fillRect(-HALF_EDGE, -HALF_EDGE, PLAYER_EDGE, PLAYER_EDGE)
    // ctx.fillRect(x - HALF_EDGE, y - HALF_EDGE, PLAYER_EDGE, PLAYER_EDGE)
    if (playerId === myPlayerId) {
      ctx.strokeRect(-HALF_EDGE, -HALF_EDGE, PLAYER_EDGE, PLAYER_EDGE)
    }
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.font = '20px Arial'
    ctx.fillText(score, 0, 7)
    ctx.restore()
    if(teamid!= game.players[myPlayerId].teamid) ctx.fillStyle = 'purple'
    else ctx.fillStyle = 'blue'
    for(let shotId in shots){
      const {sx,sy} = shots[shotId]
      ctx.beginPath()
      ctx.arc(sx,sy,SHOT_RADIUS,0,2*Math.PI)
      ctx.fill()
    }
  }
  //draw leaderboard
    ctx.fillStyle = '#C1FFC1'
    ctx.fillRect(window.innerWidth-160,0,155,120)
    ctx.fillStyle = 'black'
    ctx.textAlign = 'center'
    ctx.font = 'bold 20px Arial'
    let posx = window.innerWidth-80
    let posy = 20
    ctx.fillText("LEADERBOARD", window.innerWidth-80,20)
    posy+=30
    let sortedteam = sort(game.teams)
    for(var i=0; i<4; ++i){
      ctx.font = '15px Arial'
      ctx.fillText(i+1+". "+sortedteam[i].name+": "+sortedteam[i].score,posx,posy+i*20)
    } //utilitzar length i no variable magica
}

function sort(t){
  let sorted = t
  for(var i=0;i<4; ++i){
    for(var j=0;j<4; ++j){
      if (t[i].score> t[j].score){
        aux = sorted[i]
        sorted[i] = t[j]
        sorted[j] = aux
      } else if( t[i].score == t[j].score){
        if(t[i].name > t[j].name){
          aux = sorted[i]
          sorted[i] = t[j]
          sorted[j] = aux
        }
      }
    }
  }
  return sorted
}
let lastLogic = Date.now()
function gameloop () {
  requestAnimationFrame(gameloop)

  const now = Date.now()
  const delta = now - lastLogic
  lastLogic = now

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
  socket.on('world:init', function (serverPlayers, serverCoins, myId, teams) {
    game.onWorldInit(serverPlayers, serverCoins,teams)
    myPlayerId = myId
  })
  socket.on('playerMoved', game.onPlayerMoved.bind(game))
  socket.on('updatescores',game.onUpdateScore.bind(game))
  socket.on('playerDisconnected', game.onPlayerDisconnected.bind(game))
  socket.on('coinSpawned', game.onCoinSpawned.bind(game))
  socket.on('coinCollected', game.onCoinCollected.bind(game))
  socket.on('playerDMGD', game.onPlayerDMGD.bind(game))
  socket.on('playerShooting',game.onPlayerShoot.bind(game))
  socket.on('game:pong', (serverNow) => {
    ping = (Date.now() - lastPingTimestamp) / 2
    clockDiff = (serverNow + ping) - Date.now()
    console.log({ ping, clockDiff })
  })
})

requestAnimationFrame(gameloop)