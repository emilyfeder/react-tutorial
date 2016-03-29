#My implementation of the React Tutorial, plus some extras:
I decided to try my hand at go, which I've never used before, for the server.
In addition to doing the base tutorial, I also added:
- A delete button for every comment
- Put newest comments on top
- Pagination description ( i.e. showing 1-3 of 5)
- Load more button at the bottom (upon page load) if there are more than 4 comments

# React Tutorial

This is the React comment box example from [the React tutorial](http://facebook.github.io/react/docs/tutorial.html).

## To use
```sh
go run server.go
```

And visit <http://localhost:3000/>. Try opening multiple tabs!

## Changing the port

You can change the port number by setting the `$PORT` environment variable before invoking any of the scripts above, e.g.,

```sh
PORT=3001 node server.js
```
