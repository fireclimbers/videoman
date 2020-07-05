import React, { Component } from 'react';
import VideoAnnotator from './VideoAnnotator/VideoAnnotator';
//import VideoAnnotator from './VideoAnnotator/video-annotator-base.jsx';
import 'semantic-ui-css/semantic.min.css';
import './theme/bootstrap.config.js';
import './theme/font-awesome.config.js';

export default class App extends Component {
  constructor(props) {
    super(props);

    this.state = {

    };
  }
  render() {
    return (
      <div>
        <VideoAnnotator />
      </div>
    );
  }
}

