console.log('im game!')
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
let players = {}

const ACCEL = 1 / 500

function updateInputs () {
    const { inputs } = myPlayer

    for (let key in inputs) {
        inputs[key] = kbd.isKeyDown(kbd[key])
    }
}

function logic (delta) {
    // JSON for two equal objects should be the same string
    // const oldInputs = JSON.stringify(Object.assign({}, myPlayer.inputs))
    const oldInputs = Object.assign({},  myPlayer.inputs)
    updateInputs()

    const vInc = ACCEL * delta
    for (let playerId in players) {
        const player = players[playerId]
        const { inputs } = player
        if (inputs.LEFT_ARROW) player.vx -= vInc
        if (inputs.RIGHT_ARROW) player.vx += vInc
        if (inputs.UP_ARROW) player.vy -= vInc
        if (inputs.DOWN_ARROW) player.vy += vInc

        player.x += player.vx * delta
        player.y += player.vy * delta
    }

    if (!deepEqual(myPlayer.inputs, oldInputs)) {
        socket.emit('move', myPlayer)
    }
}

const canvas = document.createElement('canvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
document.body.appendChild(canvas)

const ctx = canvas.getContext('2d')

function render () {
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)

    for (let playerId in players) {
        const { color, x, y } = players[playerId]
        ctx.fillStyle = color
        ctx.fillRect(x, y, 50, 50)
        if (playerId === myPlayerId) {
            ctx.strokeRect(x, y, 50, 50)
        }
    }
}

let past = Date.now()
function gameloop () {
    requestAnimationFrame(gameloop)
    const now = Date.now()
    const delta = now - past
    past = now
    logic(delta)
    render()
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
    socket.on('world:init', function (serverPlayers, myId) {
        myPlayerId = myId
        myPlayer.id = myId
        players = serverPlayers
        players[myId] = myPlayer
    })

    socket.on('playerMoved', function (player) {
        players[player.id] = player
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
    })

    socket.on('playerDisconnected', function (playerId) {
        delete players[playerId]
    })

    socket.on('game:pong', (serverNow) => {
        ping = (Date.now() - lastPingTimestamp) / 2
        clockDiff = (serverNow + ping) - Date.now()
    })
})

requestAnimationFrame(gameloop)