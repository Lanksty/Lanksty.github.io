class Food {
    constructor(snake, size) {
        this.new_position(snake)
        this.size = size
    }

    new_position(snake) {
        position = {
            x: Math.round((Math.random() * ( c.width- this.size) ) / this.size) * this.size,
            y: Math.round((Math.random() * ( c.height - this.size ) ) / this.size) * this.size
        }
        if  ( position.x != snake.position.x && position.y != snake.position.y ) {
            this.position = position
            for (let tail of snake.tail) {
                if ( position.x == tail.position.x && position.y == tail.position.y ) {
                    position = this.new_position(snake);
                    break;
                }
            }
            return
        }
        position = this.new_position(snake)
    }

    draw() {
        canvas.fillStyle = "red"
        canvas.fillRect(this.position.x, this.position.y, this.size, this.size)
    }
}

class Snake {
    constructor({position = {x: 0, y: 0}}, size) {
        this.position = position
        this.tail = []
        this.size = size
        this.dir = {x:1,y:0};
    }

    reset() {
        this.new_position()
        this.tail = []
    }

    new_position() {
        this.position =  {
            x: Math.round((Math.random() * c.width) / this.size) * this.size,
            y: Math.round((Math.random() * c.height) / this.size) * this.size
        }
    }

    draw() {
        canvas.fillStyle = "white"
        canvas.fillRect(this.position.x, this.position.y, this.size, this.size)
        this.tail.forEach( tail => {
            tail.draw()
        })
    }

    move() {
        this.moveTail();
        this.position.y += this.size * this.dir.y;
        this.position.x += this.size * this.dir.x;
        // // Up
        // if ( this.dir.y == -1 ) {
        //     this.position.y -= this.size;
        // }
        // // Down
        // if ( this.dir.y == 1 ) {
        //     this.position.y += this.size;
        // }
        // // Left
        // if ( this.dir.x == -1 ) {
        //     this.position.x -= this.size;
        // }
        // // Right
        // if ( this.dir.y == 1 ) {
        //     this.position.x += this.size;
        // }
    }

    moveTail() {
        if ( this.tail[0] ) {
            for (let i = this.tail.length - 1; i >= 0; i--) {
                if ( i != 0 ) this.tail[i].position = this.tail[i-1].position
                else this.tail[i].position = {
                    x: this.position.x,
                    y: this.position.y
                }
            }
        }
    }
    
    grow() {
        let length = this.tail.length
        let position = this.position

        // Moving Up
        if ( this.dir.y == -1 ) {
            position = {
                x: position.x,
                y: position.y + this.size
            }
        }

        // Moving Down
        if ( this.dir.y == 1 ) {
            position = {
                x: position.x,
                y: position.y - this.size
            }
        }

         // Moving Left
        if ( this.dir.x == -1 ) {
            position = {
                x: position.x + this.size,
                y: position.y
            }
        }

        // Moving Right
        if ( this.dir.x == 1 ) {
            position = {
                x: position.x - this.size,
                y: position.y
            }
        }

        if ( length > 0 ) {
            position = this.tail[length - 1].position
        }

        this.tail.push(new Tail(position, this.size))
    }

    collision() {
        let collision = false
        this.tail.forEach( tail => {
             if ( this.position.x == tail.position.x && this.position.y == tail.position.y ) collision = true
        })
        return collision
    }
}

class Tail {
    constructor({...position}, size) {
        this.position = position
        this.size = size
    }

    draw() {
        canvas.fillStyle = 'purple';
        canvas.strokeStyle = "black";
        canvas.fillRect(this.position.x, this.position.y, this.size, this.size)
        canvas.strokeRect(this.position.x, this.position.y, this.size, this.size)
    }
}