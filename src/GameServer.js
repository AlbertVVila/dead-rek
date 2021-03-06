const randomColor = require('randomcolor')
const {
  ACCEL,
  COIN_RADIUS,
  PLAYER_EDGE,
  SHOT_SPEED,
  SHOT_RADIUS,
  SHOT_DMG,
  SCREEN_SIZEX,
  SCREEN_SIZEY,
  DEATH_POINT,
  vMAX
} = require('./constants.js')

class GameServer {
  constructor (io) {
    this.players = {}
    this.coins = {}
    this.io = io
    this.nextCoinId = 0
    this.lastCoinSpawn = Date.now()
    this.teams ={}
    this.teamimg = ["ash.png","cat.png","drunk.jpg","Isee.jpg"]
    this.minorTeam = Math.floor(Math.random()*this.teamimg.length)
    this.numplayers = 0
    this.numcoins = 10

    for (let i = 0; i < 10; ++i) {
      const coin = {
        id: this.nextCoinId++,
        x: Math.random() * SCREEN_SIZEX,
        y: Math.random() * SCREEN_SIZEY
      }
      this.coins[coin.id] = coin
    }

    for(let i = 0; i<4 ; ++i){
      const equip = {
        name : "",
        score:0,
        nplayers:0
       }
       var nom
       switch(i){
          case 0: nom = 'ash' ; break
          case 1: nom = 'cat' ; break
          case 2: nom = 'drunk'; break
          case 3: nom = 'isee' ; break
       }
       equip.name = nom
       this.teams[i] = equip
    }
  }

 CalculateMinor(){
    for(var i=0;i<this.teamimg.length;++i){
        if(this.teams[this.minorTeam].nplayers > this.teams[i].nplayers)
        this.minorTeam = i
    }
  }

  onPlayerConnected (socket) {
    ++this.numplayers
    console.log(`${socket.id} connected`)
    const inputs = {
      LEFT_ARROW: false,
      RIGHT_ARROW: false,
      UP_ARROW: false,
      DOWN_ARROW: false
    }
    this.CalculateMinor()
    const shots = {}
    const player = {
      x: Math.random() * SCREEN_SIZEX,
      y: Math.random() * SCREEN_SIZEY,
      vx: 0,
      vy: 0,
      color: randomColor(),
      id: socket.id,
      score: 0,
      shots,
      lastshotid:0,
      inputs,
      team : this.teamimg[this.minorTeam],
      teamid: this.minorTeam
    }
    this.teams[this.minorTeam].nplayers++
    this.players[socket.id] = player

    socket.emit('world:init', this.players, this.coins, socket.id,this.teams)

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
    //console.log(player.score)
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
      this.teams[player.teamid].score--
      player.shots[player.lastshotid++] = shot
      this.io.sockets.emit('playerShooting',player)
    }
  }

  onPlayerDisconnected (socket) {
    --this.numplayers
    console.log(`${socket.id} disconnected`)
    const player = this.players[socket.id]
    this.teams[player.teamid].score-= player.score
    this.teams[player.teamid].nplayers--
    delete this.players[socket.id]
    socket.broadcast.emit('playerDisconnected', socket.id)
  }

  logic (delta) {
    const vInc = ACCEL * delta
    for (let playerId in this.players) { //PLAYERS
      const player = this.players[playerId]
      const { inputs,shots } = player
      if (inputs.LEFT_ARROW) player.vx-vInc <= -vMAX ? player.vx == -vMAX : player.vx -= vInc
      if (inputs.RIGHT_ARROW) player.vx+vInc >= vMAX ? player.vx == vMAX : player.vx += vInc
      if (inputs.UP_ARROW) player.vy-vInc <= -vMAX ? player.vy == -vMAX : player.vy -= vInc
      if (inputs.DOWN_ARROW) player.vy+vInc >= vMAX ? player.vy == vMAX : player.vy += vInc
      if(!inputs.LEFT_ARROW && !inputs.RIGHT_ARROW){
        if(player.vx>0){
            player.vx-vInc/3 >=0 ? player.vx-=vInc/3 : player.vx=0
        }else if(player.vx<0){
           player.vx+vInc/3 <=0 ? player.vx+=vInc/3 : player.vx=0
        } 
      }
      if(!inputs.UP_ARROW && !inputs.DOWN_ARROW){
        if(player.vy>0){
            player.vy-vInc/3 >=0 ? player.vy-=vInc/3 : player.vy=0
        }else if(player.vy<0){
           player.vy+vInc/3 <=0 ? player.vy+=vInc/3 : player.vy=0
        } 
      }
      if(player.x <= SCREEN_SIZEX && player.x>=0 ){
        player.x += player.vx * delta
      }
      if(player.y <= SCREEN_SIZEY && player.y>=0 ){
        player.y += player.vy * delta
      }
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

      for (let coinId in this.coins) { //COINS
        const coin = this.coins[coinId]
        const dist = Math.abs(player.x - coin.x) + Math.abs(player.y - coin.y)
        const radiusSum = COIN_RADIUS + (PLAYER_EDGE / 2)
        if (radiusSum > dist) {
          delete this.coins[coinId]
          this.numcoins--
          player.score++
          this.teams[player.teamid].score++
          this.io.sockets.emit('coinCollected', player.id, coinId)
        }
      }
      if(this.numplayers>0 && this.numcoins <= 5*this.numplayers){
        if (((Date.now() - this.lastCoinSpawn) > 1000/this.numplayers) || this.numcoins<= 2.5*this.numplayers) {
          const coin = {
            id: this.nextCoinId++,
            x: Math.random() * SCREEN_SIZEX,
            y: Math.random() * SCREEN_SIZEY,
          }
          this.numcoins++
          this.coins[coin.id] = coin
          this.lastCoinSpawn = Date.now()
          this.io.sockets.emit('coinSpawned', coin)
        }
      }

      for(let shotid in shots){ //shots*players
         const shot = shots[shotid]
         shot.sx += shot.vx * delta
         shot.sy += shot.vy * delta
         for(let playerId2 in this.players){
           const player2 = this.players[playerId2]
           if(this.teams[player2.teamid] == this.teams[player.teamid]) continue
            const dist = Math.abs(player2.x - shot.sx) + Math.abs(player2.y - shot.sy)
           const radiusSum = SHOT_RADIUS + (PLAYER_EDGE / 2)
           if(radiusSum > dist){
             delete this.players[playerId].shots[shotid]
             player.score+= SHOT_DMG-2
             this.teams[player.teamid].score+=SHOT_DMG-2
             player2.score-= SHOT_DMG
             this.teams[player2.teamid].score-=SHOT_DMG
             this.io.sockets.emit('playerDMGD',player,player2)
             if(player2.score <= DEATH_POINT){
                 this.io.sockets.emit('playerdead',player2)
                
                 
             }
           }
         
         }
         if(shot.sx > SCREEN_SIZEX || shot.sy > SCREEN_SIZEY
           || shot.sx <0 || shot.sy<0)
             delete shots[shotid]
      }
    }
  }

  updateScores(){
    this.io.sockets.emit('updatescores',this.teams)
  }
}

module.exports = GameServer