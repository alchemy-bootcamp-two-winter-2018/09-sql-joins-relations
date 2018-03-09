'use strict';

const pg = require('pg');
const fs = require('fs');
const express = require('express');
const PORT = process.env.PORT || 3000;
const app = express();

// TODOne: put in connection string
const conString = 'postgres://localhost:5432/demo';
const client = new pg.Client(conString);
client.connect();
client.on('error', error => {
  console.error(error);
});

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static('./public'));

// REVIEW: These are routes for requesting HTML resources.
app.get('/new', (request, response) => {
  response.sendFile('new.html', {root: './public'});
});

// REVIEW: These are routes for making API calls to enact CRUD operations on our database.
app.get('/articles', (request, response) => {
  client.query(`
    SELECT * FROM articles
    JOIN authors ON articles.author_id=authors.author_id;
  `
  )
    .then(result => {
      response.send(result.rows);
    })
    .catch(err => {
      console.error(err);
    });
});

app.post('/articles', (request, response) => {
  // Do we have an author_id for the author name sent in request.body? NOPE
  // TODOne: How do you ask the database if we have an id for this author name?
  client.query(
    `SELECT * from authors where author=$1;`,
    [request.body.author]
  )
    .then(function(result) {
      if (result.rows.length === 0) queryTwo(request);
      queryThree(request,result.rows[0].author_id);
    })
    .catch(function(err) {
      const code = err.code === '22P02' ? 400 : 500;
      response.status(code).send(err.message);
    });
});

// TODOne: this function inserts new authors
function queryTwo(request){
  client.query(
    `INSERT INTO authors(author,"authorUrl")
    VALUES($1,$2) RETURNING author_id;`,
    [request.body.author,request.body.authorUrl]
  )
    .then(function(result) {
      queryThree(request,result.rows[0].author_id);
    })
    .catch(function(err){
      if (err) console.error(err);
    });
}



// TODOne: this function inserts the article
function queryThree(request,author_id) {
  console.log('Author Exists is true!');
  client.query(
    `INSERT INTO articles(author_id,title,category,"publishedOn",body)
    VALUES($1,$2,$3,$4,$5);`,
    [author_id,request.body.title,request.body.category,request.body.publishedOn,request.body.body])
    .then(function() {
      console.log('insert complete');
    })
    .catch(function(err){
      if (err) console.error(err);
    });
}


app.put('/articles/:id', function(request, response) {
  console.log(request.body.author_id);
  client.query(
    `UPDATE articles
    SET title = $1,
    category = $2,
    "publishedOn" = $3,
    body = $4 
    WHERE author_id = $5;`,
    [request.body.title,request.body.category,request.body.publishedOn,request.body.body,request.body.author_id]
  )
    .then(() => {
      client.query(
        `UPDATE authors
        SET author = $1,
        "authorUrl" = $2
        WHERE author_id= $3;
        `,
        [request.body.author,request.body.authorUrl,request.body.author_id]
      );
    })
    .then(() => {
      response.send('Update complete');
    })
    .catch(err => {
      console.error(err);
    });
});

app.delete('/articles/:id', (request, response) => {
  client.query(
    `DELETE FROM articles WHERE article_id=$1;`,
    [request.params.id]
  )
    .then(() => {
      response.send('Delete complete');
    })
    .catch(err => {
      console.error(err);
    });
});

app.delete('/articles', (request, response) => {
  client.query('DELETE FROM articles')
    .then(() => {
      response.send('Delete complete');
    })
    .catch(err => {
      console.error(err);
    });
});

// REVIEW: This calls the loadDB() function, defined below.
loadDB();

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}!`);
});


//////// ** DATABASE LOADERS ** ////////
////////////////////////////////////////

// REVIEW: This helper function will load authors into the DB if the DB is empty.
function loadAuthors() {
  fs.readFile('./public/data/hackerIpsum.json', 'utf8', (err, fd) => {
    JSON.parse(fd).forEach(ele => {
      client.query(
        'INSERT INTO authors(author, "authorUrl") VALUES($1, $2) ON CONFLICT DO NOTHING',
        [ele.author, ele.authorUrl]
      );
    });
  });
}

// REVIEW: This helper function will load articles into the DB if the DB is empty.
function loadArticles() {
  client.query('SELECT COUNT(*) FROM articles')
    .then(result => {
      if(!parseInt(result.rows[0].count)) {
        fs.readFile('./public/data/hackerIpsum.json', 'utf8', (err, fd) => {
          JSON.parse(fd).forEach(ele => {
            client.query(`
            INSERT INTO
            articles(author_id, title, category, "publishedOn", body)
            SELECT author_id, $1, $2, $3, $4
            FROM authors
            WHERE author=$5;
            `,
            [ele.title, ele.category, ele.publishedOn, ele.body, ele.author]
            );
          });
        });
      }
    });
}

// REVIEW: Below are two queries, wrapped in the loadDB() function, which create separate tables in our DB, and create a relationship between the authors and articles tables.
// THEN they load their respective data from our JSON file.
function loadDB() {
  client.query(`
    CREATE TABLE IF NOT EXISTS
    authors (
      author_id SERIAL PRIMARY KEY,
      author VARCHAR(255) UNIQUE NOT NULL,
      "authorUrl" VARCHAR (255)
    );`
  )
    .then(data => {
      loadAuthors(data);
    })
    .catch(err => {
      console.error(err);
    });

  client.query(`
    CREATE TABLE IF NOT EXISTS
    articles (
      article_id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES authors(author_id),
      title VARCHAR(255) NOT NULL,
      category VARCHAR(20),
      "publishedOn" DATE,
      body TEXT NOT NULL
    );`
  )
    .then(data => {
      loadArticles(data);
    })
    .catch(err => {
      console.error(err);
    });
}
