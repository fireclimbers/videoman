import React, { Component } from 'react';
import { getPoint, convertKeyToString, getWindowDimeshions, findIndex, shortcuts, videoDimensions, frameEmpty, loop } from './helper';
import produce from "immer";
import './hella-cutie-styles2.css';
import MotherModal from '../components/mother-modal.jsx';

const Mousetrap = require('mousetrap');
const SVG = require('svg.js');

export default class VideoAnnotator extends Component {
  constructor(props) {
    super(props);

    // Video vars
    const fps = 60;
    const vidHeight = 1080;
    const vidWidth = 1920;
    // Window
    const { windowWidth, windowHeight } = getWindowDimeshions();

    this.state = {
      origVideoWidth: vidWidth,
      origVideoHeight: vidHeight,
      fps: fps,
      annotations: {},
      colors: ['#e53935',
        '#8e24aa',
        '#3949ab',
        '#039be5',
        '#00897b',
        '#7cb342',
        '#fdd835',
        '#fb8c00',
        '#6d4c41',
        '#546e7a',
        '#d81b60',
        '#5e35b1',
        '#1e88e5',
        '#00acc1',
        '#43a047',
        '#c0ca33',
        '#ffb300',
        '#f4511e',
        '#757575'],
      labels: [
        /*{
          type: 'class',
          label: 'cecum',
          values: [true, false],
          color: '#039be5'
        },
        {
          type: 'class',
          label: 'bbps',
          values: [0, 1, 2, 3, false],
          color: '#00897b'
        }*/
      ],
      videoTitle: '',
      newBox: [], //values for when drawing new box
      selectedObjLabel: {}, // will have these properties: {label, value (single), color, type}
      animationStartTime: undefined,
      canvasSet: false,
      newObjLabelText: '', // Label value for creating new label
      editingObjLabelIndex: -1,
      newClassLabelText: '', // Same but with class
      editingClassLabelIndex: -1,
      marginTop: 0,
      marginLeft: 0,
      opacity: 0.1, // opacity of inside of boxes
      defaultPlaybackRate: 1,
      video: 'https://anno-test-ation.s3.us-east-2.amazonaws.com/outpy3.mp4',
      selectedObjAnnotation: {}, // The label of the currently selected annotation
      windowHeight,
      windowWidth,
      buffers: []
    };
    this.mousedownHandle = this.mousedownHandle.bind(this);
    this.mousemoveHandle = this.mousemoveHandle.bind(this);
    this.mouseupHandle = this.mouseupHandle.bind(this);
    this.resizeWindow = this.resizeWindow.bind(this);
    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.seekRelative = this.seekRelative.bind(this);
    this.seek = this.seek.bind(this);
    this.changePlaybackRateRate = this.changePlaybackRateRate.bind(this);
  }
  componentDidMount() {
    window.addEventListener('resize', this.resizeWindow);
    setTimeout(this.setBuffers.bind(this), 500);
  }
  what2() {
    const f = this.getCurrentFrame();

    // TODO if there are no object annotations within this frame, seek frame forward and nothing else
    if (!this.state.annotations[f]) {
      this.seekFrameForward(1 / this.state.fps);
      return;
    }

    let objectLabels = Object.keys(this.state.annotations[f]).filter((itm,index) => this.state.annotations[f][itm].type === 'object');
    if (objectLabels.length === 0) {
      this.seekFrameForward(1 / this.state.fps);
      return;
    }

    let video = document.getElementById('theviceo');
    video.setAttribute("crossOrigin", "");
    let cap = new window.cv.VideoCapture(video);

    // parameters for lucas kanade optical flow
    let winSize = new window.cv.Size(21, 21); //15,15
    let maxLevel = 3; //2
    let criteria = new window.cv.TermCriteria(window.cv.TERM_CRITERIA_EPS | window.cv.TERM_CRITERIA_COUNT, 10, 0.03);

    // take first frame and find corners in it
    let oldFrame = new window.cv.Mat(video.height, video.width, window.cv.CV_8UC4);
    cap.read(oldFrame);
    let oldGray = new window.cv.Mat();
    window.cv.cvtColor(oldFrame, oldGray, window.cv.COLOR_RGB2GRAY);

    // TODO loop thru each point
    let p0 = new window.cv.Mat(objectLabels.length*2, 1, window.cv.CV_32FC2);
    for (let i=0;i<objectLabels.length;i++) {
      let box = this.state.annotations[f][objectLabels[i]].value;
      p0.data32F[i*4] = box.tlx*video.width;
      p0.data32F[(i*4)+1] = box.tly*video.height;
      p0.data32F[(i*4)+2] = box.brx*video.width;
      p0.data32F[(i*4)+3] = box.bry*video.height;
    }

    let frame = new window.cv.Mat(video.height, video.width, window.cv.CV_8UC4);
    let frameGray = new window.cv.Mat();
    let p1 = new window.cv.Mat();
    let st = new window.cv.Mat();
    let err = new window.cv.Mat();

    // Go forward one frame
    this.seekRelative(1/this.state.fps);

    var that = this;
    function processVideo() {
      try {
          // start processing.
          cap.read(frame);
          window.cv.cvtColor(frame, frameGray, window.cv.COLOR_RGBA2GRAY);

          // calculate optical flow
          window.cv.calcOpticalFlowPyrLK(oldGray, frameGray, p0, p1, st, err, winSize, maxLevel, criteria);

          var tlxa = [];
          var tlya = [];
          var brxa = [];
          var brya = [];

          for (let i=0;i<objectLabels.length;i++) {
            tlxa.push(p1.data32F[i*4]/video.width);
            tlya.push(p1.data32F[(i*4)+1]/video.height);
            brxa.push(p1.data32F[(i*4)+2]/video.width);
            brya.push(p1.data32F[(i*4)+3]/video.height);
          }
          
          that.setState(
            produce(draft => {
              for (let i=0;i<objectLabels.length;i++) {
                if (!draft.annotations[f+1]) {
                  draft.annotations[f+1] = {[objectLabels[i]]: {value: {}, type:'object'}}
                }
                if (!draft.annotations[f+1][objectLabels[i]]) {
                  draft.annotations[f+1][objectLabels[i]] = {value: {}, type:'object'}
                }
                let tlx = tlxa[i];
                let tly = tlya[i];
                let brx = brxa[i];
                let bry = brya[i];

                if (tlx > brx) {
                  let temp = tlx;
                  tlx = brx;
                  brx = temp;
                }

                if (tly > bry) {
                  let temp = tly;
                  tly = bry;
                  bry = temp;
                }

                if (tlx < 0) {
                  tlx = 0;
                }
                if (tly < 0) {
                  tly = 0;
                }

                if (brx > video.width) {
                  brx = video.width;
                }
                if (bry > video.height) {
                  bry = video.height;
                }

                draft.annotations[f+1][objectLabels[i]].value.tlx = tlx;
                draft.annotations[f+1][objectLabels[i]].value.tly = tly;
                draft.annotations[f+1][objectLabels[i]].value.brx = brx;
                draft.annotations[f+1][objectLabels[i]].value.bry = bry;

              }
              
            })
          )

          frame.delete(); oldGray.delete(); p0.delete(); p1.delete(); err.delete();// mask.delete();
          frameGray.delete();
          oldFrame.delete();
          st.delete();
      } catch (err) {
          console.log(err);
      }
    }

    setTimeout(processVideo, 200);
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeWindow);
  }
  resizeWindow() {
    if (this.state.videoLoad) {
      this.setState({ canvasSet: false, videoLoad: false, video: this.state.video + '?ts=' + new Date() });
    }
    if (this.resizeTo) clearTimeout(this.resizeTo);
    this.resizeTo = setTimeout(() => clearTimeout(this.resizeTo), 2000);
  }
  changePlaybackRateRate(steps) {
    this.player.playbackRate = steps;
    this.setState({ defaultPlaybackRate: steps });
  }
  setBuffers(e) {
    // Show the red line that shows what parts of the video are buffered

    if (this.player && this.player.buffered) {
      let buffers = [];
      for (let i=0;i<this.player.buffered.length;i++) {
        buffers.push([this.player.buffered.start(i),this.player.buffered.end(i)]);
      }
      this.setState({
        buffers
      })
    }
    setTimeout(this.setBuffers.bind(this), 500);
  }
  play() {
    this.player.play();
    if (!this.state.rfa) {
      var elements = document.getElementsByClassName('nodeo');
      for (var i = 0; i < elements.length; i++) {
          var element = elements[i];

          element.remove();
      }
      this.raf = requestAnimationFrame((ts) => { 
        this.setState({
          animationStartTime: ts
        })
        this.increasePlayerTime(ts); 
      });
      this.setState({ rfa: true });
    }
    return false;
  }
  pause() {
    // Pauses and makes sure it pauses on a frame-aligned timestamp
    var elements = document.getElementsByClassName('nodeo');
    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];

        element.remove();
    }
    cancelAnimationFrame(this.raf);
    //const player = this.state.player;
    const frame = this.getCurrentFrame();
    //console.log(frame);
    const seconds = frame/this.state.fps;
    //console.log(seconds);
    this.player.currentTime = seconds;
    this.setState({ rfa: false });
    this.player.pause();
    return false;
  }
  increasePlayerTime(ts) {
    // Draws rectangles while video is playing

    if (!this.player || !this.player.currentTime) {
      cancelAnimationFrame(this.raf);
      this.setState({ rfa: false });
      return;
    }

    // elapsed since start time
    let timeTraveled = (ts - (this.state.animationStartTime ? this.state.animationStartTime : window.performance.now())) / 1000;

    // 0.9 / 60 * 1 = 0.015
    // 0.9 / 30 * 1 = 0.03
    // why 0.9?
    let threshold = ( 0.9 / (this.state.fps * this.player.playbackRate));

    if (!this.DrawBoard) this.DrawBoard = SVG(this.svgId).size(this.state.videoWidth, this.state.videoHeight);
    
    // frame duration in s vs elapsed 
    if ((Math.floor(threshold * 100) > Math.floor(timeTraveled * 100))) {
      // If playing and not at end of video
      if (!this.player.paused && this.player.currentTime !== this.player.duration) {
        this.raf = requestAnimationFrame((ts) => { this.increasePlayerTime(ts); });
        return;
      }
    }

    const frame = this.getCurrentFrame();
    const box = this.state.annotations[frame];


    var elements = document.getElementsByClassName('nodeo');
    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];

        element.remove();
    }

    if (!frameEmpty(box) && !this.player.paused) {
      //console.log('sadfsd');
      loop(box, (item,label) => {
        //console.log(item);
        //console.log(label);
        // If video playing and frame is at same time as current time
        const lineColor = this.getColorFromLabel(label);
        let currentRect = item.value;

        let x = currentRect.tlx;
        let y = currentRect.tly;
        let xlg = currentRect.brx;
        let ylg = currentRect.bry;

        let width = Math.abs(xlg - x);
        let height = Math.abs(ylg - y);
        x = x * this.canvas.offsetWidth;
        y = y * this.canvas.offsetHeight;
        width = width * this.canvas.offsetWidth;
        height = height * this.canvas.offsetHeight;
        this.DrawBoard.rect(width, height).addClass('nodeo').attr({ x: x, y: y, fill: `${lineColor}`, cursor: 'pointer', 'fill-opacity': `${this.state.opacity}`, stroke: lineColor });
      })

    }

    // If playing and not at end of video and has annotations
    if (!this.player.paused && this.player.currentTime !== this.player.duration && Object.keys(this.state.annotations).length === 0) {
      // Reset start time and check back in a frame duration
      this.setState({
        animationStartTime: ts
      })
      this.scheduleTime = setTimeout(() => {
        this.raf = requestAnimationFrame((ts) => { this.increasePlayerTime(ts); });
      }, (threshold * 1000));
    } else {
      // Stop!!!!
      cancelAnimationFrame(this.raf);
      clearTimeout(this.scheduleTime);
      this.setState({ rfa: false });
    }
  }
  seekFrameForward() {
    const frame = this.getCurrentFrame();
    const box = this.state.annotations[frame];

    const nextBox = this.state.annotations[frame+1];

    if (!frameEmpty(box)) {
      //console.log('sadfsd');
      loop(box, (item,label) => {
        //console.log(item);
        //console.log(label);
        // If video playing and frame is at same time as current time
        if (item.type !== 'object') return;

        if (!nextBox || !nextBox[label]) {
          this.setState(
            produce(draft => {
              if (draft.annotations[frame+1]) {
                draft.annotations[frame+1][label] = {...draft.annotations[frame][label]}
              } else {
                draft.annotations[frame+1] = {[label]: {...draft.annotations[frame][label]}};
              }
            })
          )
        }
      })

    }

    this.seekRelative(1/this.state.fps);
  }
  seekRelative(seconds) {
    // For going back/forward x number of frames relative to current time

    const currentTime = this.player.currentTime;
    this.seek((currentTime + parseFloat(seconds)).toFixed(6));
    return false;
  }
  seek(seconds) {
    // Go to frame in video

    this.player.currentTime = seconds;
    if (!this.player.paused) {
      this.pause();
    } else {
      const frame = Math.round(seconds*this.state.fps);
      const newseconds = frame/this.state.fps;
      this.player.currentTime = newseconds;
      document.getElementById('progressBar').blur();
    }
  }
  superSeek(seconds) {
    // 0.000001 is the smallest increment
    // 0.016667
    // 0.033333

    // Frame 1 0.000000
    // Frame 2 happens on 0.017242 (+0.017242)
    // Frame 3 happens on 0.034483 (+0.017241)
    // Frame 4 happens on 0.051725 (+0.017242)
    // Frame 5 happens on 0.068966 (+0.017241)
    this.player.currentTime = seconds;
  }
  makePointInBoundaries(x, y) {
    // Makes sure point isnt out of video boundaries

    if (x < 0) {
      x = 0;
    }
    if (y < 0) {
      y = 0;
    }
    if (x > this.state.videoWidth) {
      x = this.state.videoWidth;
    }
    if (y > this.state.videoHeight) {
      y = this.state.videoHeight
    }
    return {x, y};
  }
  getCurrentFrame() {
    return Math.round(this.player.currentTime*this.state.fps);
  }
  mousedownHandle(event) {
    if (!this.player.paused) return;

    if (this.state.selectedObjLabel.label) {
      // Event for creating new box (creating first corner and confirming other corner)

      const frame = this.getCurrentFrame();

      const box = this.state.annotations[frame];

      if (box && box[this.state.selectedObjLabel.label]) {
        return;
      }

      // Deselect all existing boxes
      this.setState({
        selectedObjAnnotation: {},
        dragLabel: undefined
      })

      // If creating first corner
      if (this.state.newBox.length === 0) {
        this.setState(
          produce(draft => {
            draft.newBox.push([event.offsetX, event.offsetY]);
            draft.newBoxDrag = true;
          })
        )
      }
    } else if (event.target.nodeName === 'circle') {
      // Event for dragging corner of existing box

      const splits = event.target.id.split('--');
      if (splits.length >= 3) {
        let frameIndex = parseInt(splits[2], 10);
        //let rectIndex = parseInt(splits[0], 10);
        let labelIndex = splits[0];
        let pointIndex = parseInt(splits[1], 10);
        if (this.state.dragLabel === labelIndex) {
          this.setState({ selectedObjAnnotation: this.state.annotations[frameIndex][labelIndex], pointDrag: true, dragLabel: labelIndex, dragPoint: pointIndex });
        }
      }
    } else if (event.target.nodeName === 'rect') {
      // Event for dragging existing box

      const splits = event.target.id.split('--');
      if (splits.length >= 2) {
        let frameIndex = parseInt(splits[1], 10);
        //let rectIndex = parseInt(splits[0], 10);
        let labelIndex = splits[0];

        this.setState({ selectedObjAnnotation: this.state.annotations[frameIndex][labelIndex], rectDrag: true, dragLabel: labelIndex, dragPoint: [event.offsetX, event.offsetY] });
      }
    }
  }
  mousemoveHandle(event) {
    // If mouse is holding box corner
    if (this.state.pointDrag) {
      const offsetX = event.offsetX;
      const offsetY = event.offsetY;
      this.setState(
        produce(draft => {
          let currentRect = draft.selectedObjAnnotation.value;

          const newx = getPoint(offsetX / draft.videoWidth);
          const newy = getPoint(offsetY / draft.videoHeight);

          // this.state.dragPoint 0 = tl, 1 = tr, 2 = bl, 3 = br
          if (draft.dragPoint === 0) {
            currentRect.tlx = newx;
            currentRect.tly = newy;
          } else if (draft.dragPoint === 1) {
            currentRect.brx = newx;
            currentRect.tly = newy;
          } else if (draft.dragPoint === 2) {
            currentRect.tlx = newx;
            currentRect.bry = newy;
          } else if (draft.dragPoint === 3) {
            currentRect.brx = newx;
            currentRect.bry = newy;
          }

          draft.annotations[this.getCurrentFrame()][draft.dragLabel].value = currentRect;
        })
      )
    } else if (this.state.rectDrag) {
      // If mouse is holding middle of box
      const dx = (event.offsetX - this.state.dragPoint[0]) / this.state.videoWidth;
      const dy = (event.offsetY - this.state.dragPoint[1]) / this.state.videoHeight;

      this.setState(
        produce(draft => {
          let currentRect = draft.selectedObjAnnotation.value;

          currentRect.tlx = getPoint(currentRect.tlx+dx);
          currentRect.tly = getPoint(currentRect.tly+dy);
          currentRect.brx = getPoint(currentRect.brx+dx);
          currentRect.bry = getPoint(currentRect.bry+dy);

          draft.annotations[this.getCurrentFrame()][draft.dragLabel].value = currentRect;
          draft.dragging = true; 
          draft.dragPoint = [event.offsetX, event.offsetY];
        })
      )

    } else if (this.state.newBox.length > 0) {
      // If mouse is holding down to create new box
      let x = event.offsetX;
      let y = event.offsetY;
      if (x < 0) {
        x = 0;
      }
      if (y < 0) {
        y = 0;
      }
      if (x > this.state.videoWidth) {
        x = this.state.videoWidth;
      }
      if (y > this.state.videoHeight) {
        y = this.state.videoHeight
      }

      this.setState(
        produce(draft => {
          if (draft.newBox.length === 1) {
            draft.newBox.push([x,y]);
          } else {
            draft.newBox[1] = [x,y];
          }
        })
      )
    }
  }
  mouseupHandle(event) {

    if (this.state.newBoxDrag) {
      // If confirming other corner

      if (this.state.newBox.length < 2) {
        this.setState({
          newBox: [],
          mouseDown: false,
          newBoxDrag: false
        })
        return;
      } 

      let newBox = this.state.newBox;
      const point1 = newBox[0];
      let point2 = this.makePointInBoundaries(event.offsetX, event.offsetY);
      let tlx = getPoint(Math.min(point1[0],point2.x) / this.state.videoWidth);
      let tly = getPoint(Math.min(point1[1],point2.y) / this.state.videoHeight);
      let brx = getPoint(Math.max(point1[0],point2.x) / this.state.videoWidth);
      let bry = getPoint(Math.max(point1[1],point2.y) / this.state.videoHeight);

      let annotationObj = {};
      annotationObj.type = 'object';
      annotationObj.value = {tlx,tly,brx,bry};

      const frame = this.getCurrentFrame();

      this.setState(
        produce(draft => {
          if (draft.annotations.hasOwnProperty(frame)) {
            draft.annotations[frame][draft.selectedObjLabel.label] = annotationObj;
          } else {
            draft.annotations[frame] = {[draft.selectedObjLabel.label]: annotationObj};
          }
          draft.selectedObjAnnotation = annotationObj;
          draft.dragLabel = this.state.selectedObjLabel.label;
          draft.selectedObjLabel = {};
          draft.newBox = [];
          draft.mouseDown = false;
          draft.newBoxDrag = false;
        })
      )
    }
    // If mouse had been holding down a point
    else if (this.state.pointDrag) {
      const offsetX = event.offsetX;
      const offsetY = event.offsetY;

      this.setState(
        produce(draft => {
          let currentRect = draft.selectedObjAnnotation.value;

          let newPoint = this.makePointInBoundaries(offsetX, offsetY);
          const newx = getPoint(newPoint.x / draft.videoWidth);
          const newy = getPoint(newPoint.y / draft.videoHeight);

          // this.state.dragPoint 0 = tl, 1 = tr, 2 = bl, 3 = br
          if (draft.dragPoint === 0) {
            currentRect.tlx = newx;
            currentRect.tly = newy;
          } else if (draft.dragPoint === 1) {
            currentRect.brx = newx;
            currentRect.tly = newy;
          } else if (draft.dragPoint === 2) {
            currentRect.tlx = newx;
            currentRect.bry = newy;
          } else if (draft.dragPoint === 3) {
            currentRect.brx = newx;
            currentRect.bry = newy;
          }

          draft.annotations[this.getCurrentFrame()][draft.dragLabel].value = currentRect;
          draft.pointDrag = false;
        })
      )
    } else if (this.state.rectDrag) {
      // If mouse had been holding down middle of a box

      // If mouse moved while holding down box
      if (this.state.dragging) {
        const dx = (event.offsetX - this.state.dragPoint[0]) / this.state.videoWidth;
        const dy = (event.offsetY - this.state.dragPoint[1]) / this.state.videoHeight;

        this.setState(
          produce(draft => {
            let currentRect = draft.selectedObjAnnotation.value;

            currentRect.tlx = getPoint(currentRect.tlx+dx);
            currentRect.tly = getPoint(currentRect.tly+dy);
            currentRect.brx = getPoint(currentRect.brx+dx);
            currentRect.bry = getPoint(currentRect.bry+dy);

            draft.annotations[this.getCurrentFrame()][draft.dragLabel].value = currentRect;
            draft.dragging = false;
            draft.rectDrag = false; 
            draft.dragPoint = undefined;
            //draft.dragLabel = undefined;
          })
        )
      } else {
        // Mouse did not move while holding down box (just clicked on it)

        this.setState({ dragging: false, rectDrag: false/*, dragLabel: undefined*/ });
      }
    }
  }
  selectLabel(labelObj, e) {
    if (this.state.selectedObjLabel.label !== labelObj.label) {
      let selLabel = {label:labelObj.label,color:labelObj.color,type:labelObj.type};
      this.setState({ selectedObjLabel: selLabel });
    } else {
      this.setState({ selectedObjLabel: {} });
    }
  }
  toggleLabel(labelObj,value,e) {
    const frame = this.getCurrentFrame();
    
    // If label on frame exists
    if (this.state.annotations[frame] && this.state.annotations[frame][labelObj.label]) {
      // If values are the same
      if (this.state.annotations[frame][labelObj.label].value === value) {
        // Delete annotation
        this.setState(
          produce(draft => {
            delete draft.annotations[frame][labelObj.label];
          })
        )
      } else {
        // If values are different
        // Change value of annotation

        this.setState(
          produce(draft => {
            draft.annotations[frame][labelObj.label].value = value;
          })
        )
      }
    } else {

      this.setState(
        produce(draft => {
          // Create annotation
          let annotationObj = {};
          annotationObj.type = labelObj.type;
          //annotationObj.label = labelObj.label;
          annotationObj.value = value;
          if (draft.annotations[frame]) {
            draft.annotations[frame][labelObj.label] = annotationObj;
          } else {
            draft.annotations[frame] = {[labelObj.label]: annotationObj};
          }
        })
      )
    }
  }
  addLabel(e) {
    const label = this.state.newObjLabelText;
    var labelObj = {};
    labelObj.type = 'object';
    labelObj.label = label;
    labelObj.values = ['BOX'];

    if (this.state.colors.length > 0) {
      const color = this.state.colors[0];
      labelObj.color = color;
      this.setState(prevState => ({
        labels: [...prevState.labels, labelObj],
        colors: prevState.colors.filter(itm => itm !== color),
        newObjLabelText: ''
      }))
    }
  }
  addClassLabel(item, e) {
    var labelObj = {};
    labelObj.type = 'class';
    labelObj.label = item.name;
    labelObj.values = item.values;


    if (this.state.colors.length > 0) {
      const color = this.state.colors[0];
      labelObj.color = color;
      this.setState(prevState => ({
        labels: [...prevState.labels, labelObj],
        colors: prevState.colors.filter(itm => itm !== color),
        newClassLabelText: ''
      }))
    }
  }
  setEditingObjLabel(index,label, e) {
    this.setState({
      editingObjLabelIndex: index,
      newObjLabelText: label
    })
  }
  editObjLabel(e) {
    const index = this.state.editingObjLabelIndex;
    const value = this.state.newObjLabelText;
    const oldLabel = this.state.labels[this.state.editingObjLabelIndex];

    this.setState(
      produce(draft => {
        draft.labels = draft.labels.map((itm,idx) => { return idx === index ? { ...itm, label: value } : itm });
        draft.editingObjLabelIndex = -1;
        draft.newObjLabelText = '';

        for (var key in draft.annotations) {
          if (!draft.annotations.hasOwnProperty(key)) continue;

          draft.annotations[key][value] = { ...draft.annotations[key][oldLabel.label]};
          delete draft.annotations[key][oldLabel.label];

        }
      })
    )
  }
  editClassLabel(e) {
    const index = this.state.editingObjLabelIndex;
    const value = this.state.newObjLabelText;
    const oldLabel = this.state.labels[this.state.editingObjLabelIndex];

    this.setState(
      produce(draft => {
        draft.labels = draft.labels.map((itm,idx) => { return idx === index ? { ...itm, label: value } : itm });
        draft.editingObjLabelIndex = -1;
        draft.newObjLabelText = '';

        for (var key in draft.annotations) {
          if (!draft.annotations.hasOwnProperty(key)) continue;

          draft.annotations[key][value] = { ...draft.annotations[key][oldLabel.label]};
          delete draft.annotations[key][oldLabel.label];

        }
      })
    )
  }
  getColorFromLabel(label) {
    const labelObj = this.state.labels.filter(itm => itm.label === label);
    if (labelObj.length > 0) {
      return labelObj[0].color;
    }
    return '#222';
  }
  changeMultiple(labelObj, e) {
    // select box (box is now in selectedObjAnnotation)
    // hit Change Multiple

    // get frame
    const frame = this.getCurrentFrame();

    const origLabel = this.state.dragLabel;
    const newLabel = labelObj.label;

    if (this.state.selectedObjAnnotation.value && this.state.dragLabel) {
      this.setState(
        produce(draft => {
          for (var key in draft.annotations) {
            if (!draft.annotations.hasOwnProperty(key)) continue;
            if (key < frame) continue;

            var temp = null;
            var temp2 = null;

            if (draft.annotations[key][newLabel]) {
              temp = {...draft.annotations[key][newLabel]}
              delete draft.annotations[key][newLabel]
            }

            if (draft.annotations[key][origLabel]) {
              temp2 = {...draft.annotations[key][origLabel]}
              delete draft.annotations[key][origLabel]
            }

            if (temp) {
              draft.annotations[key][origLabel] = temp;
            }

            if (temp2) {
              draft.annotations[key][newLabel] = temp2;
            }

          }
        })
      )
    }

  }
  renderObjLabels() {
    const frame = this.getCurrentFrame();
    return ( <div>
      <div>
        <div className="field has-addons">
          <div className="control">
            <input className="input is-small" value={this.state.newObjLabelText} onChange={(event) => this.setState({newObjLabelText: event.target.value })} placeholder="Enter label..." />
          </div>
          <div className="control">
            <button className="button is-small" onClick={this.state.editingObjLabelIndex > -1 ? this.editObjLabel.bind(this) : this.addLabel.bind(this)}>+</button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', overflow: 'auto', flexDirection: 'column', height: '200px'}}>
        {this.state.labels.map((item,index) => {

          if (item.type !== 'object') return null;

          let bgLabel = item.color;
          if (this.state.selectedObjLabel.label === item.label) {
            bgLabel = '#f5f5f5';
          }
          let func = this.selectLabel.bind(this, item);
          if (this.state.annotations[frame] && this.state.annotations[frame][item.label]) {
            bgLabel = 'grey';
            func = null;
          }

          return <div>
            <div className="buttons has-addons">
              <button className="button is-small is-primary" onClick={func} key={item.label+index} id={item.label+index} style={{backgroundColor: bgLabel}}>
                <span className="icon is-small">
                  <i className="fas fa-plus"></i>
                </span>
              </button>
              <button className="button is-static is-small" style={{ backgroundColor: this.state.editingObjLabelIndex === index ? '#f48fb1' : 'white' }}>{item.label}</button>
              <button className="button is-small is-primary" onClick={this.setEditingObjLabel.bind(this,index,item.label)} key={item.label+index+'0'} id={item.label+index+'0'} style={{ backgroundColor: item.color }}>
                <span className="icon is-small">
                  <i className="fas fa-pencil-alt"></i>
                </span>
              </button>
              <button className="button is-small is-primary" onClick={this.changeMultiple.bind(this,item)} key={item.label+index+'2'} id={item.label+index+'2'} style={{backgroundColor: item.color}}>
                <span className="icon is-small">
                  <i className="fas fa-exchange-alt"></i>
                </span>
              </button>
              <button className="button is-small" onClick={this.removeLabel.bind(this,item.label)} key={item.label+index+'3'} id={item.label+index+'3'}>
                <span className="icon is-small">
                  <i className="fas fa-trash-alt"></i>
                </span>
              </button>
            </div>  
          </div>
        })}
      </div>
    </div>);
  }
  renderClassLabels() {
    const labels = this.state.labels.filter((itm) => { return itm.type === 'class' });
    const frame = this.getCurrentFrame();
    return ( <div>
      <div>
        <div className="field has-addons">
          <button className="button is-small" onClick={() => this.setState({ showModal: true, currentLabel: {}})}>Add label</button>
          {/*<div className="control">
            <input className="input is-small" value={this.state.newClassLabelText} onChange={(event) => this.setState({newClassLabelText: event.target.value })} placeholder="Enter label..." />
          </div>
          {this.state.editingClassLabelIndex === -1 && <div className="control">
            <button className="button is-small" onClick={this.addClassLabel.bind(this,'binary')}>Binary</button>
          </div>}
          {this.state.editingClassLabelIndex === -1 && <div className="control">
            <button className="button is-small" onClick={this.addClassLabel.bind(this,'multi')}>Multi</button>
          </div>}
          {this.state.editingClassLabelIndex > -1 && <div className="control">
            <button className="button is-small" onClick={this.editClassLabel.bind(this)}>+</button>
          </div>}*/}
        </div>
      </div>
      <div style={{ overflow: 'auto', height: '200px'}}>
        {labels.map((item,index) => {
          return <div key={item.label}>
            <div className="buttons has-addons">
              <button className="button is-static is-small is-primary">
                {item.label}
              </button>
              {item.values.map((item2,index2) => {
                let bgC = item.color;

                if (this.state.annotations[frame] && this.state.annotations[frame][item.label] && this.state.annotations[frame][item.label].value === item2) {
                  bgC = 'grey';
                }

                let func = this.toggleLabel;

                let s = item2;
                if (s === true) {
                  s = 'Start';
                }
                if (s === false) {
                  s = 'End';
                }

                return <button className="button is-small is-primary" key={item.label+index+s} onClick={func.bind(this, item,item2)} style={{ backgroundColor: bgC }}>{s}</button>
              })}
              <button className="button is-small" onClick={this.removeLabel.bind(this,item.label)}>
                <span className="icon is-small">
                  <i className="fas fa-trash-alt"></i>
                </span>
              </button>
            </div>
          </div>
        })}
      </div>
    </div>);
  }
  renderBoxes(data, event) {
    if (!this.player.paused) {
      if (!this.state.rfa) {
        this.setState({
          rfa: true
        })
        this.raf = requestAnimationFrame((ts) => { 
          this.setState({
            animationStartTime: ts
          })
          this.increasePlayerTime(ts); 
        });
      }
      return (null);
    }
    const frame = this.getCurrentFrame();

    const box = this.state.annotations[frame];

    if (!frameEmpty(box)) {
      return Object.keys(box).map((item, index) => {
        let rect = box[item];

        if (rect.type !== 'object') return null;
        
        const lineColor = this.getColorFromLabel(item);
        const sw = 2;

        let id = item + '--' + frame;

        let tlx = rect.value.tlx;
        let tly = rect.value.tly;
        let brx = rect.value.brx;
        let bry = rect.value.bry;

        let width = Math.abs(brx - tlx);
        let height = Math.abs(bry - tly);
        tlx = tlx * this.canvas.offsetWidth;
        tly = tly * this.canvas.offsetHeight;
        brx = brx * this.canvas.offsetWidth;
        bry = bry * this.canvas.offsetHeight;
        width = width * this.canvas.offsetWidth;
        height = height * this.canvas.offsetHeight;

        let color = this.getColorFromLabel(item);
        //color = 'rgb(80, 90, 206)';

        let swp = 1;
        let radius = 0.5;
        let style = {};

        if (this.state.newBox.length === 0) {
          style = { cursor: '-webkit-grabbing'};
        }
        if (this.state.dragLabel === item) {
          swp = 4;
          radius = 4;
        }

        const tl = [tlx, tly]
        const tr = [brx, tly]
        const bl = [tlx, bry]
        const br = [brx, bry]
        const points = [tl,tr,bl,br];

        return [
          <rect id={id} x={tlx} y={tly} width={width} height={height} style={{ fill: `${lineColor}`, cursor: 'pointer', fillOpacity: `${this.state.opacity}`, stroke: `${color}`, strokeWidth: `${sw}`  }} />
        ,
        <g>
          {points.map((item2,index2) => {
            const idp = item + '--' + index2 + '--' + frame;
            return <circle style={style} id={idp} cx={item2[0]}
                      cy={item2[1]}
                    r={radius} stroke="white" strokeWidth={swp} fill={lineColor} />
          })}
        </g>
        ];
      })
    }
    
    return null;
  }
  renderNewBox() {
    // Render new drawing box if user is drawing new box

    if (this.state.newBox.length > 1) {
      let x = Math.min(this.state.videoWidth,this.state.newBox[0][0],this.state.newBox[1][0]);
      let y = Math.min(this.state.videoHeight,this.state.newBox[0][1],this.state.newBox[1][1]);
      let xlg = Math.max(0,this.state.newBox[0][0],this.state.newBox[1][0]);
      let ylg = Math.max(0,this.state.newBox[0][1],this.state.newBox[1][1]);

      const color = this.state.selectedObjLabel.color;
      
      const width = Math.abs(xlg - x);
      const height = Math.abs(ylg - y);
      return (<rect x={x} y={y} width={width} height={height} style={{fill: `${color}`, fillOpacity: this.state.opacity, stroke: color, strokeWidth: 2 }} />);
    }
    return null;
  }
  renderAnnotationTimelineObj() {
    // Render all annotations below video



    // All frames that have annotations, sorted
    var frames = Object.keys(this.state.annotations).sort((a,b) => parseInt(a) - parseInt(b));

    // All annotations that will be displayed
    var displayAnnotations = [];

    // All object labels
    var objLabels = this.state.labels//.filter((itm) => { return itm.type === 'object'; })
    for (let i=0;i<objLabels.length;i++) {
      var objAnnotations = frames.filter((item,index) => {
        return Object.keys(this.state.annotations[item]).indexOf(objLabels[i].label) > -1;
      })
      if (objLabels[i].type === 'object') {
        if (objAnnotations.length > 0) {
          displayAnnotations.push({...this.state.annotations[objAnnotations[0]][objLabels[i].label], label: objLabels[i].label, frame: objAnnotations[0]});
        }
        if (objAnnotations.length > 1) {
          displayAnnotations.push({...this.state.annotations[objAnnotations[objAnnotations.length-1]][objLabels[i].label], label: objLabels[i].label, frame: objAnnotations[objAnnotations.length-1]});
        }
      } else {
        for (let j=0;j<objAnnotations.length;j++) {
          displayAnnotations.push({...this.state.annotations[objAnnotations[j]][objLabels[i].label], label: objLabels[i].label, frame: objAnnotations[j]})
        }
      }
    }

    return <div style={{position:'relative',display:'block'}}>
    {displayAnnotations.map((item, index) => {
      const color = this.getColorFromLabel(item.label);

      let label = item.label;
      let value = item.value;

      const yOffset = findIndex(this.state.labels,(i) => {
        return i.label === label;
      })

      let left = item.frame/Math.round(this.player.duration*this.state.fps);

      var text = label;
      if (item.type !== 'object') {
        text = value.toString();
      }

      return <span onClick={this.seekAndSelect.bind(this,item)} style={{backgroundColor:color,cursor:'pointer',position:'absolute',top:yOffset*24,left:(left*100)+'%'}} className="tag is-primary">
        {text}
      </span>
    })}
    </div>
  }
  renderBuffers() {
    return <div style={{position:'relative',display:'block'}}>
    {this.state.buffers.map((item, index) => {
      const color = '#f00';

      let start = item[0]/this.player.duration;
      let width = (item[1]-item[0])/this.player.duration;

      let left = (start*100)+'%';
      width = (width*100)+'%';

      return (<div style={{position:'absolute',width:width,left:left,backgroundColor:color,height:4}} />);
    })}
    </div>
  }
  seekAndSelect(item) {
    this.seek((item.frame/this.state.fps).toFixed(6));
    if (this.state.selectedObjAnnotation.label !== item.label && item.type === 'object') {
      this.setState({ selectedObjAnnotation: item });
    }
  }
  removeBox(event) {

    const frame = this.getCurrentFrame();
    const box = this.state.annotations[frame];

    if (box) {
      this.setState(
        produce(draft => {
          delete draft.annotations[frame][draft.dragLabel];
          draft.selectedObjAnnotation = {};
          draft.dragLabel = undefined;
        })
      )
    }
  }
  removeLabel(label, e) {
    const color = this.getColorFromLabel(label);

    this.setState(
      produce(draft => {
        for (var key in draft.annotations) {
          if (!draft.annotations.hasOwnProperty(key)) continue;
          //draft.annotations[key] = draft.annotations[key].filter((itm) => { return itm.label !== label} );
          delete draft.annotations[key][label];
        }

        draft.labels = draft.labels.filter((itm) => { return itm.label !== label} );
        draft.colors.push(color);
      })
    )

  }
  exportJson(e) {
    var exportObj = {};
    exportObj.content = this.state.video.replace('_unique','');
    exportObj.width = this.state.origVideoWidth;
    exportObj.height = this.state.origVideoHeight;
    exportObj.fps = this.state.fps;
    exportObj.labels = this.state.labels;
    exportObj.annotations = this.state.annotations;
    exportObj.currentFrame = this.getCurrentFrame();

    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    var dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", this.state.videoTitle+"_annotated.json");
    document.body.appendChild(dlAnchorElem); // Required for FF
    dlAnchorElem.click();
  }
  onReaderLoad(e) {
    var obj = JSON.parse(e.target.result);
    var usedColors = [];
    for (var i=0;i<obj.labels.length;i++) {
      obj.labels[i].color = this.state.colors[i];
      usedColors.push(this.state.colors[i]);
    }

    var content = obj.content.split('/');
    var newTitle = content[content.length-1];
    content = 'https://anno-test-ation.s3.us-east-2.amazonaws.com/dev/videos/'+content[content.length-1]
    if (content.indexOf('_unique') === -1) content = content.replace('.mp4','_unique.mp4').replace('.mkv','_unique.mkv');

    this.setState(prevState => ({
      video: content,
      videoTitle: newTitle,
      origVideoHeight: obj.height,
      origVideoWidth: obj.width,
      fps: obj.fps,
      labels: obj.labels,
      annotations: obj.annotations,
      canvasSet: false,
      videoLoad: false,
      currentFrame: obj.currentFrame,
      colors: prevState.colors.filter(itm => usedColors.indexOf(itm) === -1 )
    }))
    this.player.source = obj.content;
    this.DrawBoard = null;
  }
  importJson(e) {
    var reader = new FileReader();
    reader.onload = this.onReaderLoad.bind(this);
    reader.readAsText(e.target.files[0]);
  }
  handleChange(e) {
    var args = {};
    args[e.target.id] = e.target.value;
    this.setState(args);
  }
  render() {
    // CONST VARS

    const canvasStyles = {
      zIndex: this.state.mouseDown ? 4 : 2,
      position: 'absolute',
      display: 'block',
      top: 0,
      left: 0,
      marginTop: this.state.marginTop,
      marginLeft: this.state.marginLeft,
      width: this.player ? this.state.videoWidth : 0,
      height: this.player ? this.state.videoHeight : 0,
      cursor: this.state.selectedObjLabel.label ? 'crosshair' : 'auto',
    };
    const cBar = document.getElementsByClassName('video-react-control-bar');
    if (cBar.length > 0) {
      cBar[0].style.display = 'none';
    }

    const setFunctions = () => {
      const canvas = this.canvas;
      if (!this.state.canvasSet && canvas && this.state.videoLoad) {
        canvas.addEventListener('mousedown', this.mousedownHandle);
        canvas.addEventListener('mousemove', this.mousemoveHandle);
        canvas.addEventListener('mouseup', this.mouseupHandle);
        this.setState({ canvasSet: true});
        this.changePlaybackRateRate(this.state.defaultPlaybackRate);
      }
    };

    let combo = undefined;
    if (this.player && this.player.paused) {
      Mousetrap.bind('space', this.play.bind(this));
    } else if (this.player) {
      Mousetrap.bind('space', this.pause.bind(this));
    }
    if ('forward' in shortcuts) {
      combo = convertKeyToString(shortcuts.forward);
      if (this.player && this.player.paused) {
        Mousetrap.bind(combo, this.seekRelative.bind(this, 1 / this.state.fps));
      } else if (this.player) {
        Mousetrap.unbind(combo);
      }
    }
    if ('backward' in shortcuts) {
      combo = convertKeyToString(shortcuts.backward);
      if (this.player && this.player.paused) {
        Mousetrap.bind(combo, this.seekRelative.bind(this, - 1 / this.state.fps));
      } else if (this.player) {
        Mousetrap.unbind(combo);
      }
    }
    if ('fast_forward' in shortcuts) {
      combo = convertKeyToString(shortcuts.fast_forward);
      if (this.player && this.player.paused) {
        Mousetrap.bind(combo, this.seekRelative.bind(this, 600 / this.state.fps));
      } else if (this.player) {
        Mousetrap.unbind(combo);
      }
    }
    if ('fast_backward' in shortcuts) {
      combo = convertKeyToString(shortcuts.fast_backward);
      if (this.player && this.player.paused) {
        Mousetrap.bind(combo, this.seekRelative.bind(this, -600 / this.state.fps));
      } else if (this.player) {
        Mousetrap.unbind(combo);
      }
    }
    if ('predict' in shortcuts) {
      combo = convertKeyToString(shortcuts.predict);
      Mousetrap.bind(combo, this.what2.bind(this));
    }
    if ('delete' in shortcuts) {
      combo = convertKeyToString(shortcuts.delete);
      Mousetrap.bind(combo, this.removeBox.bind(this));
    }

    return (<div>
      <div style={{margin:12}}>
        <div className="field is-grouped">
          <p className="control">
            <div className="file has-name is-small">
              <label className="file-label">
                <input className="file-input" type="file" name="list" onChange={this.importJson.bind(this)}/>
                <span className="file-cta">
                  <span className="file-icon">
                    <i className="fas fa-upload"></i>
                  </span>
                  <span className="file-label">
                    Choose a file…
                  </span>
                </span>
                <span className="file-name">
                  {this.state.videoTitle}
                </span>
              </label>
            </div>
          </p>
          <p className="control">
            <button className="button is-small" onClick={this.exportJson.bind(this)}>Export</button>
          </p>
        </div>
      </div>
        
      <div style={{ /*lineHeight: 0,*/ display: 'flex', flexDirection: 'row', justifyContent: 'space-around'}}>
        <div style={{ display: 'flex', flexDirection: 'column'}}>
          <div style={{ /*lineHeight: 0,*/ display: 'block', position: 'relative' }}>
            <div style={{width: this.state.windowWidth, height: this.state.windowHeight}}>
              <div style={{ position: 'relative' }}>
                <video
                  id="theviceo"
                  crossOrigin="Anonymous"
                  ref={(player) => { this.player = player; }}
                  aspectratio="16:9"
                  onLoadedMetadata={(e1, e2, e3) => {
                    const { width, height } = videoDimensions(this.player);
                    let marginLeft = 0;
                    let marginTop = 0;
                    if (height !== this.state.windowHeight) {
                      marginTop = Math.abs(height - this.state.windowHeight) / 2;
                    }
                    if (width !== this.state.windowWidth) {
                      marginLeft = Math.abs(width - this.state.windowWidth) / 2;
                    }
                    this.setState({ videoLoad: true, videoHeight: height, marginTop, marginLeft, videoWidth: width });
                    if (this.state.currentFrame) {
                      const currentFrame = this.state.currentFrame;
                      this.setState({
                        currentFrame: null
                      }, () => {
                        this.seek(currentFrame/this.state.fps);
                      })
                    }
                  }}
                  width={this.state.windowWidth} height={this.state.windowHeight}
                  preload="auto"
                  fluid={false}
                  src={this.state.video} />
                {!this.state.videoLoad && <div>
                  Loading
                </div>}
                {this.state.videoLoad && <div ref={(canv) => { this.canvas = canv; setFunctions();}} style={canvasStyles}>
                  {this.canvas && this.canvas.offsetWidth && <svg id="drawing" ref={(id) => {  this.svgId = id }} style={{ width: this.state.videoWidth, height: this.state.videoHeight }}>
                    {this.renderBoxes()}
                    {this.state.newBox && this.state.newBox.length > 0 && this.canvas && this.renderNewBox()}
                    {/*this.state.player.paused && this.state.newBox.length > 1 && this.renderPointsForNewBox()*/}
                  </svg>}
                </div>}
              </div>
            </div>
          </div>

          {this.state.videoLoad && <div>
            <div className="buttons has-addons is-centered" style={{marginBottom:0}}>
                <button className="button is-small" onClick={this.seekRelative.bind(this, -600 / this.state.fps)}>
                  <span className="icon is-small">
                    <i className="fas fa-fast-backward"></i>
                  </span>
                </button>
                <button className="button is-small" onClick={this.seekRelative.bind(this, -1 / this.state.fps)}>
                  <span className="icon is-small">
                    <i className="fas fa-step-backward"></i>
                  </span>
                </button>
                {this.player.paused && <button className="button is-small" onClick={this.play}>
                  <span className="icon is-small">
                  <i className="fas fa-play"></i>
                </span>
                </button>}
                {!this.player.paused && <button className="button is-small" onClick={this.pause}>
                  <span className="icon is-small">
                    <i className="fas fa-pause"></i>
                  </span>
                </button>}
                <button className="button is-small" onClick={this.what2.bind(this)}>
                  <span className="icon is-small">
                    <i className="fas fa-dragon" style={{color:'#a657de'}}></i>
                  </span>
                </button>
                <button className="button is-small" onClick={this.seekRelative.bind(this, 1 / this.state.fps)}>
                  <span className="icon is-small">
                    <i className="fas fa-step-forward"></i>
                  </span>
                </button>
                <button className="button is-small" onClick={this.seekRelative.bind(this, 600 / this.state.fps)}>
                  <span className="icon is-small">
                    <i className="fas fa-fast-forward"></i>
                  </span>
                </button>
            </div> 

            <div style={{display:'block',textAlign:'center'}}>
              {this.player.currentTime.toFixed(0)} / {this.player.duration.toFixed(0)} / {this.getCurrentFrame()}
            </div>

            <p>Playback Speed : <b>{this.player.playbackRate}x</b></p>
            <input style={{width:'25%'}} onChange={(event, data) => { this.changePlaybackRateRate(parseFloat(event.target.value)); }} min={0.1} step={0.1} max={2} type="range" value={this.player.playbackRate} />
          </div>}
        </div>
        <div style={{ flexGrow: 1.5 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around'}}>
            <div style={{ position: 'relative', border: '1px solid #eaf2f4', backgroundColor: '#f5f9fa', boxSizing: 'border-box' }}>
              <div>
                Objects
              </div>
              {this.player && this.renderObjLabels('object')}
            </div>
            <div style={{ position: 'relative', border: '1px solid #eaf2f4', backgroundColor: '#f5f9fa', boxSizing: 'border-box' }}>
              <div>
                Classifications
              </div>
              {this.player && this.renderClassLabels()}
            </div>

            <div style={{ position: 'relative', border: '1px solid #eaf2f4', backgroundColor: '#f5f9fa', boxSizing: 'border-box' }}>
              {this.player && <div>
                <button onClick={this.superSeek.bind(this, parseFloat(this.state.timeget))}>SEEk</button>
                <input type="text" onChange={(e) => {this.setState({ timeget: e.target.value })}} value={this.state.timeget} />
              </div>}
            </div>
          </div>
        </div>
      </div>

      {this.state.videoLoad && <div style={{flex:1,flexDirection:'row',margin:12,marginBottom:300}}>
        {this.renderBuffers()}
        <input id="progressBar" title="Progress" style={{ padding: '2px', display:'block',width:'100%' }} onChange={(event, data) => { this.seek(event.target.value); }} min={0} step={0.0001} max={this.player.duration} type="range" value={this.player.currentTime} />
        {this.renderAnnotationTimelineObj()}
      </div>}

      <MotherModal
        showModal={this.state.showModal}
        currentItem={this.state.currentLabel || {}}
        submitModal={this.addClassLabel.bind(this)}
        closeModal={() => this.setState({showModal: false})}
        title={'Class label'}/>

    </div>);
  }
}

