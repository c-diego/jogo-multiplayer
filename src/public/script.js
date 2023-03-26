let connected = false
const socket = io();
let game
const scoreTable = document.getElementById('score-table')
const gameCanvas = document.getElementById('game-canvas')
let totalPlayersCount = ''
const collectFruitAudio = new Audio('/collect.mp3')
const collect100FruitAudio = new Audio('/100-collect.mp3')

socket.on('connect', () => {
  connected = true
  console.log('> Connected to server')
})

socket.on('disconnect', () => {
  console.log('> Disconnected')
  connected = false
})

socket.on('bootstrap', (gameInitialState) => {
  game = gameInitialState
  console.log('> Received initial state')
  gameCanvas.style.width = `${game.canvasWidth * 18}px`
  gameCanvas.style.height = `${game.canvasHeight * 18}px`
  gameCanvas.width = game.canvasWidth
  gameCanvas.height = game.canvasHeight

  const context = gameCanvas.getContext('2d')

  requestAnimationFrame(renderGame)

  function renderGame() {
    const allPixels = game.canvasWidth * game.canvasHeight

    context.globalAlpha = 1
    context.fillStyle = 'white'
    context.fillRect(0, 0, game.canvasWidth, game.canvasHeight)

    for (const socketId in game.players) {
      const player = game.players[socketId]
      context.fillStyle = '#000000'
      context.globalAlpha = 0.1
      context.fillRect(player.x, player.y, 1, 1)
    }

    for (const fruitId in game.fruits) {
      const fruit = game.fruits[fruitId]
      context.fillStyle = '#08a331'
      context.globalAlpha = 1
      context.fillRect(fruit.x, fruit.y, 1, 1)
    }

    const currentPlayer = game.players[socket.id]
    context.fillStyle = '#F0DB4F'
    context.globalAlpha = 1
    context.fillRect(currentPlayer.x, currentPlayer.y, 1, 1)


    requestAnimationFrame(renderGame)
  }

  updateScoreTable()
})

socket.on('player-update', (player) => {
  game.players[player.socketId] = player.newState
})

socket.on('update-player-score', (score) => {
  game.players[socket.id].score = score
  updateScoreTable()
})

socket.on('player-remove', (socketId) => {
  delete game.players[socketId]
})

socket.on('fruit-add', (fruit) => {
  game.fruits[fruit.fruitId] = {
    x: fruit.x,
    y: fruit.y
  }
})

socket.on('fruit-remove', ({ fruitId, score }) => {
  delete game.fruits[fruitId]
  multipleOf100Remainder = score % 100

  if (multipleOf100Remainder !== 0) {
    collectFruitAudio.pause()
    collectFruitAudio.currentTime = 0
    collectFruitAudio.play()
  }

  if (multipleOf100Remainder === 0 && score !== 0) {
    collectFruitAudio.pause()
    collect100FruitAudio.pause()
    collect100FruitAudio.currentTime = 0
    collect100FruitAudio.play()
  }

  updateScoreTable()
})

socket.on('concurrent-connections', (concurrentConnections) => {
  totalPlayersCount = concurrentConnections
  updateScoreTable()
})

let crazyModeInterval
socket.on('start-crazy-mode', () => {
  crazyModeInterval = setInterval(() => {
    const randomKey = 37 + Math.floor(Math.random() * 4)
    console.log(randomKey)
    const event = new KeyboardEvent('keydown', {
      keyCode: randomKey,
      which: randomKey
    })

    document.dispatchEvent(event);
  }, 150)
})

socket.on('stop-crazy-mode', () => {
  clearInterval(crazyModeInterval)
})

socket.on('show-max-concurrent-connections-message', () => {
  document.getElementById('max-concurrent-connection-message').style.display = 'block'
  document.getElementById('game-container').style.display = 'none'
})

socket.on('hide-max-concurrent-connections-message', () => {
  document.getElementById('max-concurrent-connection-message').style.display = 'none'
  document.getElementById('game-container').style.display = 'block'
})

function updateScoreTable() {
  const maxResults = 10

  let scoreTableInnerHTML = `
        <tr class="header">
            <td>Top 10 Jogadores</td>
            <td>Pontos</td>
        </tr>
    `
  const scoreArray = []

  for (socketId in game.players) {
    const player = game.players[socketId]
    scoreArray.push({
      socketId: socketId,
      score: player.score
    })
  }

  const scoreArraySorted = scoreArray.sort((first, second) => {
    if (first.score < second.score) {
      return 1
    }

    if (first.score > second.score) {
      return -1
    }

    return 0
  })

  const scoreSliced = scoreArraySorted.slice(0, maxResults)

  scoreSliced.forEach((score) => {

    scoreTableInnerHTML += `
            <tr class="${socket.id === score.socketId ? 'current-player' : ''}">
                <td class="socket-id">${score.socketId}</td>
                <td class="score-value">${score.score}</td>
            </tr>
        `
  })

  let playerNotInTop10 = true

  for (const score of scoreSliced) {
    if (socket.id === score.socketId) {
      playerNotInTop10 = false
      break
    }

    playerNotInTop10 = true
  }

  if (playerNotInTop10) {
    scoreTableInnerHTML += `
            <tr class="current-player bottom">
                <td class="socket-id">${socket.id}</td>
                <td class="score-value">${game.players[socket.id].score}</td>
            </tr>
        `
  }

  scoreTableInnerHTML += `
        <tr class="footer">
            <td>Total de jogadores</td>
            <td align="right">${totalPlayersCount}</td>
        </tr>
    `

  scoreTable.innerHTML = scoreTableInnerHTML


}

function handleKeydown(event) {
  if (connected) {
    const player = game.players[socket.id]

    if (event.which === 37 && player.x - 1 >= 0) {
      player.x = player.x - 1
      socket.emit('player-move', 'left')
      return
    }

    if (event.which === 38 && player.y - 1 >= 0) {
      player.y = player.y - 1
      socket.emit('player-move', 'up')
      return
    }

    if (event.which === 39 && player.x + 1 < game.canvasWidth) {
      player.x = player.x + 1
      socket.emit('player-move', 'right')
      return
    }
    if (event.which === 40 && player.y + 1 < game.canvasHeight) {
      player.y = player.y + 1
      socket.emit('player-move', 'down')
      return
    }
  }
}

// Essa lógica deveria estar no server.
// Como está no front, é fácil burlar.
function throttle(callback, delay) {
  let isThrottled = false, args, context;

  function wrapper() {
    if (isThrottled) {
      args = arguments;
      context = this;
      return;
    }

    isThrottled = true;
    callback.apply(this, arguments);

    setTimeout(() => {
      isThrottled = false;
      if (args) {
        wrapper.apply(context, args);
        args = context = null;
      }
    }, delay);
  }

  return wrapper;
}

const throttledKeydown = throttle(handleKeydown, 80);

document.addEventListener('keydown', throttledKeydown);