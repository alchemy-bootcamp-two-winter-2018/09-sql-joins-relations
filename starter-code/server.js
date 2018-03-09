'use strict';

const pg = require('pg');
const fs = require('fs');
const express = require('express');
const PORT = process.env.PORT || 3000;
const app = express();

const conString = 'postgres://postgres:wastu3eg@localhost:5432/kilovolt';
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
  SELECT * FROM articles;
  `)
    .then(result => {
      response.send(result.rows);
    })
    .catch(err => {
      console.error(err)
    });
});

app.post('/articles', (request, response) => {
  // Do we have an author_id for the author name sent in request.body?
  client.query(
    // TODONE: How do you ask the database if we have an id for this author name?
    `
    SELECT author_id
    FROM authors
    WHERE author = '$1'
    `,
    [request.body.author]
  )
  .then(() => {
    console.log('Author found. Proceeding to add article.');
    queryThree(request.body.title, request.body.category, request.body.publishedOn, request.body.body, request.body.author);
  })
  
  .catch(() => {
    console.log('Author not found. Adding author.');
    queryTwo(request.body.author, request.body.authorUrl);
    queryThree(request.body.title, request.body.category, request.body.publishedOn, request.body.body, request.body.author);
  });

  // TODONE: this function inserts new authors
  function queryTwo(newAuthor, newAuthorUrl) {
    client.query(
      `
      INSERT INTO authors (author, "authorUrl")
      VALUES ($1, $2) ON CONFLICT DO NOTHING;
      `,
      [newAuthor, newAuthorUrl])
      .then(() => {
      console.log('New author created');
      queryThree(request.body.title, request.body.category, request.body.publishedOn, request.body.body, request.body.author);
    })
    .catch(() => {
      console.log('Query Two Failure. Aborting.');
    });
  }
  // TODOne: this function inserts the article
  function queryThree(title, category, publishedOn, body, author) {
    client.query(
      `
      INSERT INTO articles(author_id, title, category, "publishedOn", body)
      SELECT author_id, $1, $2, $3, $4
      FROM authors
      WHERE author=$5;
`,
      [title, category, publishedOn, body, author])
    .then(() => {
      console.log(`Article successfully added! Title: ${title}, Author: ${author}.`)
    })

    .catch(() => {
      console.log('Query three error. Aborting.')
    })
  };
});

app.put('/articles/:id', function(request, response) {
  client.query(
    `
    SELECT *
    FROM articles
    WHERE author_id = $1;
    `,
    [request.params.id]
  )
    .then(() => {
      client.query(
        ``,
        []
      )
    })
    .then(() => {
      response.send('Update complete');
    })
    .catch(err => {
      console.error(err);
    })
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
      console.error(err)
    });
});

app.delete('/articles', (request, response) => {
  client.query('DELETE FROM articles')
    .then(() => {
      response.send('Delete complete');
    })
    .catch(err => {
      console.error(err)
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
      )
    })
  })
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
            )
          })
        })
      }
    })
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
      console.error(err)
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
      console.error(err)
    });
}