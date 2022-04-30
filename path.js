
function Node(x, y) {
    this.x = x * tile_size;
    this.y = y * tile_size;
    this.parent = null;
    this.gScore = -1;
    this.fScore = -1;
    this.isTail = false;
    this.hCalc = (food_x, food_y) => {
        return Math.floor(Math.abs(food_x - this.x) + Math.abs(food_y - this.y));
    };
}

function newGrid(size) {
    let grid = new Array(size);
    for(let i = 0; i < size; i++) {
        grid[i] = new Array(size);
    }

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            grid[y][x] = new Node(x, y);
        }   
    }
    return grid;
}

function checkTail(node) {
    for (tail of snake.tail) {
        if ( node.x == tail.position.x && node.y == tail.position.y ) {
            return false;
        }
    }
    return true;
}
function checkBoundary(currentNode, i, j) {

    let y = currentNode.y + i * tile_size;
    let x =  currentNode.x + j * tile_size;

    if ( x < 0 || x > c.width - 1 || y < 0 || y > c.height - 1 ) return false;

    if ((currentNode.y + i == currentNode.y && currentNode.x + j == currentNode.x) || ((i == -1) && (j == -1)) || ((i == -1) && (j == 1)) || ((i == 1) && (j == -1)) || ((i == 1) && (j == 1))) {
        return false;   
    }
    let behind = {x: snake.position.x - snake.dir.x * tile_size, y: snake.position.y - snake.dir.y * tile_size};
    if ( currentNode.x == behind.x && currentNode.y == behind.y) return false;

    return true;
}


function findPath(direction) {
    // Player --> snake in grid format
    // Find shortest path from Player to Food using A*
    let player = {
        x: snake.position.x / tile_size,
        y: snake.position.y / tile_size
    };

    grid = newGrid(ROWS)
    
    // Set tail nodes for boundary checks
    snake.tail.forEach( tail => {
        let nodeX = tail.position.x / tile_size;
        let nodeY = tail.position.y / tile_size;
        grid[nodeY][nodeX].isTail = true;
    })
    // Initiate open and closed set
    let openList = [];
    let closedList = [];
    let tailList = [];

    // Push starting position to open set
    let newPlayer = grid[player.y][player.x]
    newPlayer.gScore = 0;
    newPlayer.fScore = newPlayer.hCalc(food.position.x, food.position.y);
    openList.push(newPlayer);

    let counter = 0;

    // Sort open set so that first item is smallest f score
    while ( openList.length > 0 ) {
        counter++;
        openList.sort( (a,b) => {
            if ( a.fScore < b.fScore ) return -1;
            else if ( a.fScore > b.fScore ) return 1;
            return 0;
        })

        let currentNode = openList.splice(0, 1)[0];

        if ( currentNode.x == food.position.x && currentNode.y == food.position.y ) {
            return makePath(currentNode);
        }

        closedList.push(currentNode);

        for ( let i = -1; i < 2 ; i++ ) {
            for ( let j = -1; j < 2; j++ ) {

                if ( !checkBoundary(currentNode, i, j) ) {
                    continue;
                }

                let nextNode = grid[currentNode.y / tile_size + i][currentNode.x / tile_size + j];

                if ( nextNode.isTail ) {
                    continue;
                }
                
                // if ( !checkTail(nextNode) ) {
                //     tailList.push(nextNode);
                //     console.log("second function")
                //     continue;
                // }                
                // if( tailList.indexOf(currentNode) != -1 ) {
                //     console.log("***********ERROR")
                //     continue;
                // }
                // if( tailList.indexOf(nextNode) != -1 ) {
                //     console.log("***********ERROR")
                //     continue;
                // }
                if ( closedList.indexOf(nextNode) != -1 ) {
                    continue;
                }
                
                let tScore = nextNode.gScore + 1;
                
                if ( closedList.indexOf(nextNode) == -1 ) openList.push(nextNode);
                
                nextNode.parent = currentNode;
                nextNode.gScore = tScore;
                nextNode.fScore = nextNode.gScore + nextNode.hCalc(food.position.x, food.position.y);
            }
        }
        // if ( counter == 200 ) return makePath(currentNode);
    }
    if (closedList.length < 2) return false;
    return makePath(closedList.at(-1));
}

function makePath(node) {
    let path = [node];
    while ( node.parent != null ) {
        path.push(node.parent);
        node = node.parent;
    }
    if ( path.at(-1).x == snake.position.x && path.at(-1).y == snake.position.y ) path.pop();
    return path;
}