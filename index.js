const c = document.querySelector("canvas")
const score = document.getElementById("score")
const checkbox = document.getElementById("AI");
c.width = 500
c.height = 500
var tile_size = 5
const ROWS = c.height / tile_size;
const COLS = c.width / tile_size;
var gameSpeed = 1;
var frameLimit = 1;
var path = [];

c.style.margin = "auto"
c.style.display = "block"

const canvas = c.getContext("2d")

function createBackground() {
    canvas.fillStyle = "black"
    canvas.strokeStyle = "white"
    canvas.fillRect(0,0,c.width,c.height)
    canvas.strokeRect(0,0,c.width,c.height)
}

const game = {
    paused: false,
    score: 0,
}

function newGame(snake, food) {
    game.paused = true
    game.score = 0
    snake.reset()
    food.new_position(snake)
    canvas.fillStyle = "red"
    canvas.font = "30px Aerial";
    canvas.fillText('Space to start', c.width / 4, c.height / 2)
    path = [];
}

snake = new Snake(position = {
    x: 0, y: 0
}, size = tile_size)

food = new Food(snake, size = tile_size)

newGame(snake, food)

var current_frame = 0

function animate() {
    current_frame++
    
    if ( current_frame % frameLimit == 0 && game.paused == false ) {
        for (let i = 0; i < gameSpeed; i++) {
            canvas.clearRect(0,0,c.width, c.height)
            createBackground()
            snake.draw()
            food.draw()
            if ( checkbox.checked ) {
                if ( path.length == 0 ) {
                    path = findPath(direction);
                    if ( path === false ) {
                        path = [];
                        newGame(snake, food);
                    }
                }
                if ( path.length > 0 ) {
                    let nextNode = path.at(-1);
                    snake.dir = getDirection(snake.position, nextNode);
                    snake.moveTail(); 
                    snake.position.x = nextNode.x;
                    snake.position.y = nextNode.y;
                    path.pop();
                }
            } else {
                path = [];
                snake.move();
            }
        }
    }
    // Check collision with tail:
    if ( snake.collision() === true ) {
        newGame(snake, food)
    }

    // Check collision with walls:
    if ( snake.position.x >= c.width ) newGame(snake, food)
    else if ( snake.position.x < 0 ) newGame(snake, food)
    else if ( snake.position.y >= c.height ) newGame(snake, food)
    else if ( snake.position.y < 0 ) newGame(snake, food)
    
    // Check collision with food:
    if ( snake.position.x == food.position.x && snake.position.y == food.position.y ) {
        food.new_position(snake)
        snake.grow()
        path = [];
    }

    game.score = snake.tail.length
    score.innerText = `${game.score}`
    window.requestAnimationFrame(animate)
}

function game_pause_menu() {
    if ( game.paused == false ) return
    canvas.fillStyle = "red"
    canvas.font = "30px Aerial";
    canvas.fillText('Game Paused', c.width / 4, c.height / 2)
}

direction = 'down'
var dir = { x: 0, y: 0}

window.addEventListener("keydown", e => {
    if ( e.key == 'ArrowUp' ) {
        if ( snake.dir.y == 1 ) return
        snake.dir.x = 0;
        snake.dir.y = -1;
    }
    if ( e.key == 'ArrowDown' ) {
        if ( snake.dir.y == -1 ) return
        snake.dir.x = 0;
        snake.dir.y = 1;
    }
    if ( e.key == 'ArrowLeft' ) {
        if ( snake.dir.x == 1 ) return
        snake.dir.y = 0;
        snake.dir.x = -1;
    }
    if ( e.key == 'ArrowRight' ) {
        if ( snake.dir.x == -1 ) return
        snake.dir.y = 0;
        snake.dir.x = 1;

    }
    if ( e.key == "v" ) snake.grow(direction)
    if ( e.key == ' ' ) {
        game.paused = !game.paused
        game_pause_menu()
    }
    if ( e.key == "l" ) checkbox.checked = !checkbox.checked;
})

function getDirection(snake, node) {
    let x = node.x - snake.x;
    let y = node.y - snake.y;
    if ( x > 0 ) return {x: 1, y: 0};
    if ( x < 0 ) return {x: -1, y: 0};
    if ( y > 0 ) return {x: 0, y: 1};
    if ( y < 0 ) return {x: 0, y: -1};
}

function changeSpeed(increase) {
    if ( increase ) {
        frameLimit--;
        if ( frameLimit < 1 ) {
            frameLimit = 1;
        gameSpeed++;
        }
    } else {
        gameSpeed--
        if (gameSpeed < 1) {
            gameSpeed = 1;
            frameLimit++;
        }
    }
}

animate()