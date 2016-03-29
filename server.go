/**
 * This file provided by Facebook is for non-commercial testing and evaluation
 * purposes only. Facebook reserves all rights not expressly granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * FACEBOOK BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 * edited by: Emily Feder
 */

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
	"strconv"
)

type Comment struct {
	ID     int64  `json:"id"`
	Author string `json:"author"`
	Text   string `json:"text"`
}

type Response struct {
	Comments []Comment `json:"comments"`
	Count int `json:"count"`
}

const dataFile = "./comments.json"

var commentMutex = new(sync.Mutex)

func writeCommentsToFile(comments []Comment, fi os.FileInfo) (string) {
	var commentData, err = json.MarshalIndent(comments, "", "    ")
	if err != nil {
		return fmt.Sprintf("Unable to marshal comments to data file (%s): %s", dataFile, err)
	}
	// Write out the comments to the file, preserving permissions
	err = ioutil.WriteFile(dataFile, commentData, fi.Mode())
	if err != nil {
		return fmt.Sprintf("Unable to write comments to data file (%s): %s", dataFile, err)
	}

	return ""
}

// Handle comments
func handleComments(w http.ResponseWriter, r *http.Request) {
	// Since multiple requests could come in at once, ensure we have a lock
	// around all file operations
	commentMutex.Lock()
	defer commentMutex.Unlock()

	// Stat the file, so we can find its current permissions
	fi, err := os.Stat(dataFile)
	if err != nil {
		http.Error(w, fmt.Sprintf("Unable to stat the data file (%s): %s", dataFile, err), http.StatusInternalServerError)
		return
	}

	// Read the comments from the file.
	commentData, err := ioutil.ReadFile(dataFile)
	if err != nil {
		http.Error(w, fmt.Sprintf("Unable to read the data file (%s): %s", dataFile, err), http.StatusInternalServerError)
		return
	}

	// Decode the JSON data
	var comments []Comment
	if err := json.Unmarshal(commentData, &comments); err != nil {
		http.Error(w, fmt.Sprintf("Unable to Unmarshal comments from data file (%s): %s", dataFile, err), http.StatusInternalServerError)
		return
	}

	var start, _ = strconv.ParseInt(r.URL.Query().Get("start"), 10, 64);
	var end, _ = strconv.ParseInt(r.URL.Query().Get("end"), 10, 64);

	switch r.Method {
	case "POST":
		//delete or add a comment
		if r.FormValue("reason") == "delete" {
			var newcomments []Comment
			for _, c := range comments {
				var id, err = strconv.ParseInt(r.FormValue("id"), 10, 64);
				if err == nil && c.ID != id {
					newcomments = append(newcomments, c);
				}
			}
			comments = newcomments
		} else {
			comments = append([]Comment{{ID: time.Now().UnixNano() / 1000000, Author: r.FormValue("author"), Text: r.FormValue("text")}}, comments...)
		}

		//refresh the end
		if (len(comments) == 0) {
			end = 0
		} else if (end > int64(len(comments))) {
			end = int64(len(comments))
		}

		response := Response{Comments:comments[start:end], Count: len(comments)}

		// Marshal the response to indented json.
		responseData, err := json.MarshalIndent(response, "", "    ")
		if err != nil {
			http.Error(w, fmt.Sprintf("Unable to marshal response to json: %s", err), http.StatusInternalServerError)
			return
		}

		// Write out the comments to the file, preserving permissions
		write_err := writeCommentsToFile(comments, fi)
		if write_err != "" {
			http.Error(w, write_err, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		io.Copy(w, bytes.NewReader(responseData))

	case "GET":
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		if (len(comments) == 0) {
			end = 0
		} else if (end > int64(len(comments))) {
			end = int64(len(comments))
		}

		response := Response{Comments:comments[start:end], Count: len(comments)}

		// stream the contents of the file to the response
		responseData, err := json.MarshalIndent(response, "", "    ")
		if err != nil {
			http.Error(w, fmt.Sprintf("Unable to marshal response to json: %s", err), http.StatusInternalServerError)
			return
		}

		io.Copy(w, bytes.NewReader(responseData))

	default:
		// Don't know the method, so error
		http.Error(w, fmt.Sprintf("Unsupported method: %s", r.Method), http.StatusMethodNotAllowed)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	http.HandleFunc("/api/comments", handleComments)
	http.Handle("/", http.FileServer(http.Dir("./public")))
	log.Println("Server started: http://localhost:" + port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
