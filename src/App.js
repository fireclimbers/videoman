import React, { Component } from 'react';
import VideoAnnotator from './VideoAnnotator/VideoAnnotator';
import 'semantic-ui-css/semantic.min.css';
import './theme/bootstrap.config.js';
import './theme/font-awesome.config.js';

export default class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      shortcuts: {
        next: {
          qualifier: "",
          key: "right"
        },
        previous: {
          qualifier: "",
          key: "left"
        },
        skip: {
          qualifier: "ctrl",
          key: "q"
        },
        moveToDone: {
          qualifier: "ctrl",
          key: "enter"
        },
        forward: {
          qualifier: "",
          key: "]"
        },
        backward: {
          qualifier: "",
          key: "["
        },
        fast_forward: {
          qualifier: "",
          key: "}"
        },
        fast_backward: {
          qualifier: "",
          key: "{"
        },
        delete: {
          qualifier: "",
          key: "backspace"
        },
        clearAll: {
          qualifier: "ctrl",
          key: "x"
        },
        undo: {
          qualifier: "ctrl",
          key: "z"
        }
      },
      isFullscreenEnabled: false,
      video: ''
    };
  }
  render() {
    return (
      <div>
        <VideoAnnotator
          shortcuts={this.state.shortcuts}
          defaultShape="rectangle"
          fullScreen={this.state.isFullscreenEnabled}
          video={this.state.video} />
      </div>
    );
  }
}

