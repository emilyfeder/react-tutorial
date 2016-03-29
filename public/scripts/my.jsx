/**
 * Created by emilyfeder on 3/17/16.
 */

var CommentBox = React.createClass({
	getUrl: function() {
		return this.props.url + '?start=' + this.state.start_fetch + '&end=' + this.state.end_fetch
	},
	setStateFromCommentData: function(data, cb) {
		var end_fetch = typeof data.end_fetch != 'undefined' ? data.end_fetch : this.state.end_fetch;
		if (end_fetch < 4) {
			end_fetch = 4;
		}
		this.setState({
			data: data.comments || [],
			end_fetch: end_fetch,
			count: typeof data.count != 'undefined' ? data.count : this.state.count
		}, cb);
	},
	loadCommentsFromServer: function() {
		$.ajax({
			url: this.getUrl(),
			type: 'GET',
			dataType: 'json',
			cache: false,
			success: function(data) {
				this.setStateFromCommentData(data);
			}.bind(this),
			error: function(xhr, status, err) {
				console.error(this.props.url, status, err.toString());
			}.bind(this)
		});
	},
	loadMoreCommentsFromServer: function() {
		this.setState({data: this.state.data, start_fetch: this.state.start_fetch, end_fetch: this.state.end_fetch+3}, function(){
			this.loadCommentsFromServer();
		});
	},
	handleCommentSubmit: function(comment) {
		//submit to the server and refresh the comment list
		var comments = this.state.data;
		comment.id = Date.now();
		comment.reason = 'create';
		var newComments = [comment].concat(comments);
		this.setStateFromCommentData({ comments: newComments, end_fetch: this.state.end_fetch + 1 }, function(){
			$.ajax({
				url: this.getUrl(),
				dataType: 'json',
				type: 'POST',
				data: comment,
				success: function(data) {
					this.setStateFromCommentData(data);
				}.bind(this),
				error: function(xhr, status, err) {
					this.setStateFromCommentData({comments: comments, end_fetch: this.state.end_fetch - 1});
					console.error(this.getUrl(), status, err.toString());
				}.bind(this)
			});
		}.bind(this));

	},
	onCommentDelete: function(id) {
		var comments = this.state.data;
		var newComments = comments.filter(function(comment) {
			return comment.id != id;
		});
		this.setState({data: newComments, end_fetch : this.state.end_fetch - 1}, function(){
			$.ajax({
				url: this.getUrl(),
				dataType: 'json',
				type: 'POST',
				data: {id: id, reason: 'delete'},
				success: function(data) {
					this.setStateFromCommentData(data);
				}.bind(this),
				error: function(xhr, status, err) {
					this.setStateFromCommentData({comments: comments, end_fetch: this.state.end_fetch + 1});
					console.error(this.getUrl(), status, err.toString());
				}.bind(this)
			});
		}.bind(this));
	},
	getInitialState: function() {
		return {data:[], start_fetch: 0, end_fetch: 4, count: 0}
	},
	componentDidMount: function() {
		this.loadCommentsFromServer();
		setInterval(this.loadCommentsFromServer, this.props.pollInterval)
	},
	render: function() {
		var load_more_button;
		if (this.state.count > this.state.data.length) {
			load_more_button = <button onClick={this.loadMoreCommentsFromServer}>Load More</button>;
		}
		return(
			<div className="commentBox">
				<h1>Comments</h1>
				<CommentForm onCommentSubmit={this.handleCommentSubmit}/>
				<CommentList data={this.state.data} onCommentDelete={this.onCommentDelete}/>
				<PaginationDescription start={this.state.count == 0 ? 0 : this.state.start_fetch + 1} end={this.state.data.length} count={this.state.count}/>
				{load_more_button}
			</div>
		);
	}
});

var CommentList = React.createClass({
	render: function() {
		var list = this;
		var commentNodes = this.props.data.map(function(comment) {
			return (
				<Comment author={comment.author} key={comment.id} comment_id={comment.id} onCommentDelete={list.props.onCommentDelete}>
					{comment.text}
				</Comment>
			);
		});
		return (
			<div className="commentList">
				{commentNodes}
			</div>
		);
	}
});

var Comment = React.createClass({
	rawMarkup: function() {
		var rawMarkup = marked(this.props.children.toString(), {sanitize: true});
		return { __html: rawMarkup };
	},
	deleteComment: function(e) {
		console.log('comment delete' + this.props.comment_id)
		this.props.onCommentDelete(this.props.comment_id);
	},
	render: function() {
		return (
			<div className="comment">
				<h2 className="commentAuthor">
					{this.props.author}
				</h2>
				<span dangerouslySetInnerHTML={this.rawMarkup()} />
				<button className="deleteButton red" onClick={this.deleteComment}>Delete</button>
			</div>
		)
	}
});

var CommentForm = React.createClass({
	getInitialState: function() {
		return {author: '', text:''}
	},
	handleAuthorChange: function(e) {
		this.setState({ author: e.target.value })
	},
	handleTextChange: function(e) {
		this.setState({ text: e.target.value })
	},
	handleSubmit: function(e) {
		e.preventDefault();
		var author = this.state.author.trim();
		var text = this.state.text.trim();
		if (!text || !author) {
			return;
		}
		this.props.onCommentSubmit({author: author, text: text});
		this.setState({author: '', text: ''});
	},
	render: function() {
		return (
			<form className="commentForm" onSubmit={this.handleSubmit}>
				<input
					type="text"
					placeholder="Your name"
					value={this.state.author}
					onChange={this.handleAuthorChange}
				/>
				<input
					type="text"
					placeholder="Say something..."
					value={this.state.text}
					onChange={this.handleTextChange}
				/>
				<input type="submit" value="Post" />
			</form>
		)
	}
});

var PaginationDescription = React.createClass({
	render: function() {
		return (
			<div className="paginationDescription">
				Showing {this.props.start} - {this.props.end} of {this.props.count}
			</div>
		)
	}
});

ReactDOM.render(
	<CommentBox url="/api/comments" pollInterval={60000}/>,
	document.getElementById('content')
);