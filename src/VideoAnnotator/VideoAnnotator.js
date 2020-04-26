import React, { Component } from 'react';
import { Button, Label, Icon, Dimmer, Loader, Input } from 'semantic-ui-react';
import { getPoint, convertKeyToString, getWindowDimeshions, findIndex, shortcuts } from './helper';
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
      annotations: [],
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
          persist: true,
          values: [true, false],
          color: '#039be5'
        },
        {
          type: 'class',
          label: 'bbps',
          persist: true,
          values: [0, 1, 2, 3, false],
          color: '#00897b'
        }*/
      ],
      newBox: [], //values for when drawing new box
      selectedObjLabel: {}, // will have these properties: {label, value (single), color, type, persist}
      animationStartTime: undefined,
      canvasSet: false,
      newObjLabelText: '', // Label value for creating new label
      editingObjLabelIndex: -1,
      newClassLabelText: '', // Same but with class
      translate: {
        x: 0,
        y: 0
      },
      marginTop: 0,
      marginLeft: 0,
      opacity: 0.1, // opacity of inside of boxes
      defaultPlaybackRate: 1,
      defaultVolume: 0.0,
      scale: 1,
      video: 'https://docbot-s3.s3.us-east-2.amazonaws.com/test/outpy3.mp4',
      selectedObjAnnotation: '', // The label of the currently selected annotation
      windowHeight,
      windowWidth,
      player: this.player,
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
    this.setVolume = this.setVolume.bind(this);
    this.handleStateChange = this.handleStateChange.bind(this);
  }
  componentDidMount() {
    window.addEventListener('resize', this.resizeWindow);
    setTimeout(this.setBuffers.bind(this), 500);
  }
  componentWillReceiveProps(nextProps) {
    // TODO put this in when importing new video
    if (this.props.video !== nextProps.video) {
      this.setState({canvasSet: false, videoLoad: false, video: nextProps.video });
      this.player.source = nextProps.video;
      this.DrawBoard = null;
    }
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeWindow);
  }
  resetImage() {
    clearTimeout(this.resizeTo);
  }
  resizeWindow() {
    if (this.state.videoLoad) {
      this.setState({ canvasSet: false, videoLoad: false, video: this.state.video + '?ts=' + new Date() });
    }
    if (this.resizeTo) clearTimeout(this.resizeTo);
    this.resizeTo = setTimeout(this.resetImage.bind(this), 2000);
  }
  videoDimensions(video) {
    // Ratio of the video's intrisic dimensions
    var videoRatio = video.videoWidth / video.videoHeight;

    var { windowWidth, windowHeight } = getWindowDimeshions();
    // The ratio of the element's width to its height
    var elementRatio = windowWidth / windowHeight;
    // If the video element is short and wide
    if (elementRatio > videoRatio) windowWidth = windowHeight * videoRatio;
    // It must be tall and thin, or exactly equal to the original ratio
    else windowHeight = windowWidth / videoRatio;
    return {
      width: windowWidth,
      height: windowHeight
    };
  }
  setVolume(steps) {
    let player = {...this.state.player, volume: steps};
    this.setState({ defaultVolume: steps, player });
  }
  changePlaybackRateRate(steps) {
    this.state.player.playbackRate = steps;
    this.setState({ defaultPlaybackRate: steps });
  }
  setBuffers(e) {
    // Show the red line that shows what parts of the video are buffered

    if (this.state.player && this.state.player.buffered) {
      let buffers = [];
      for (let i=0;i<this.state.player.buffered.length;i++) {
        buffers.push([this.state.player.buffered.start(i),this.state.player.buffered.end(i)]);
      }
      this.setState({
        buffers
      })
    }
    setTimeout(this.setBuffers.bind(this), 500);
  }
  play() {
    this.state.player.play();
    if (!this.state.rfa) {
      window.requestAnimationFrame((ts) => { 
        let animationStartTime = this.state.animationStartTime;
        animationStartTime = ts;
        this.setState({
          animationStartTime
        })
        this.increasePlayerTime(ts); 
      });
      //this.state.rfa = true;
      this.setState({ rfa: true });
    }
    return false;
  }
  pause() {
    // Pauses and makes sure it pauses on a frame-aligned timestamp

    window.cancelAnimationFrame(this.increasePlayerTime);
    const player = this.state.player;
    const frame = this.getCurrentFrame();
    //console.log(frame);
    const seconds = frame/this.state.fps;
    //console.log(seconds);
    player.currentTime = seconds;
    this.setState({ rfa: false });
    this.state.player.pause();
    this.setState({ player });
    return false;
  }
  handleStateChange(eventName, event) {
    // Copy player state to this component's state

    // TODO should player = event.target be in or out of the conditional?????
    //this.state.player = event.target;
    if (!this.state.rfa || this.state.player.paused || eventName !== 'onTimeUpdate') {
      this.setState({
        player: event.target
      });
    } else if (eventName === 'onTimeUpdate' && !this.state.player.paused) {
      let pBar = document.getElementById("progressBar");
      if (this.ptextPlay !== null && this.state.rfa) {
        let nowTime = `${this.state.player.currentTime} / ${this.state.player.duration}`;
        nowTime = nowTime + ' ';
        this.ptextPlay.innerHTML =  nowTime;
        pBar.value = this.state.player.currentTime;
      }
    }
  }
  increasePlayerTime(ts) {
    // Draws rectangles while video is playing

    if (this.state.player === undefined || this.state.player.currentTime === undefined) {
      window.cancelAnimationFrame(this.increasePlayerTime);
      this.setState({ rfa: false });
      return;
    }
    let timeTraveled = (ts - (this.state.animationStartTime ? this.state.animationStartTime : window.performance.now())) / 1000;
    let threshold = ( 0.9 / (this.state.fps * this.state.player.playbackRate));
    if (!this.DrawBoard) this.DrawBoard = SVG(this.svgId).size(this.state.videoWidth, this.state.videoHeight);
    // debugger;
    if ((Math.floor(threshold * 100) > Math.floor(timeTraveled * 100))) {
      if (!this.state.player.paused && this.state.player.currentTime !== this.state.player.duration) {
        window.requestAnimationFrame((ts) => { this.increasePlayerTime(ts); });
        return;
      }
    }

    const filteredArray = this.state.annotations.filter((itm) => {
      return itm.type === 'object';
    });

    filteredArray.map((rect, index) => {
      let id = index;
      id = index + '--node';

      // If video playing and frame is at same time as current time
      if (!this.state.player.paused && (this.getCurrentFrame() === rect.frame)) {
        const lineColor = this.getColorFromLabel(rect.label);
        let currentRect = rect.value;

        let element = document.getElementById(id);
        if (element !== null) {
          let animationStartTime = this.state.animationStartTime;
          animationStartTime = ts;
          this.setState({
            animationStartTime
          })
        } else {
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
          this.DrawBoard.rect(width, height).id(id).attr({ x: x, y: y, fill: `${lineColor}`, cursor: 'pointer', 'fill-opacity': `${this.state.opacity}`, stroke: '#1ae04e' });
        }
      } else {
        let el = SVG.get(id)
        if (el !== null) {
          try {
            el.remove();
          } catch (ex) {
            console.log('increasePlayerTime 2 remove node exception', ex);
          }
        }
      }
    })

    const scheduleTime = () => {
      window.requestAnimationFrame((ts) => { this.increasePlayerTime(ts); });
    }

    if (!this.state.player.paused && this.state.player.currentTime !== this.state.player.duration && this.state.annotations.length > 0) {
      let animationStartTime = this.state.animationStartTime;
      animationStartTime = ts;
      this.setState({
        animationStartTime
      })
      setTimeout(scheduleTime, (threshold * 1000));
    } else {
      window.cancelAnimationFrame(this.increasePlayerTime);
      clearTimeout(scheduleTime);
      this.setState({ rfa: false });
    }
  }
  seekRelative(seconds) {
    // For going back/forward x number of frames relative to current time

    const player = this.state.player;
    const currentTime = player.currentTime;
    this.seek((currentTime + parseFloat(seconds)).toFixed(6));
    return false;
  }
  seek(seconds) {
    // Go to frame in video

    const player = this.state.player;
    player.currentTime = seconds;
    if (!this.state.player.paused) {
      this.pause();
    } else {
      const frame = Math.round(seconds*this.state.fps);
      const newseconds = frame/this.state.fps;
      player.currentTime = newseconds;
      this.setState({ player });
    }
    //this.setState({ player });
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
    return Math.round(this.state.player.currentTime*this.state.fps);
  }
  mousedownHandle(event) {
    if (!this.state.player.paused) return;

    if (this.state.selectedObjLabel.label) {
      // Event for creating new box (creating first corner and confirming other corner)

      // Deselect all existing boxes
      this.setState({
        selectedObjAnnotation: {}
      })

      // If creating first corner
      if (this.state.newBox.length === 0) {
        const newBox = this.state.newBox;
        newBox.push([event.offsetX, event.offsetY]);
        this.setState({
          newBox,
          newBoxDrag: true
        });
      }
    } else if (event.target.nodeName === 'circle') {
      // Event for dragging corner of existing box

      const splits = event.target.id.split('--');
      if (splits.length >= 3) {
        let timeIndex = parseInt(splits[2], 10);
        let rectIndex = parseInt(splits[0], 10);
        let pointIndex = parseInt(splits[1], 10);
        if (this.state.selectedObjAnnotation.label === this.state.annotations[rectIndex].label) {
          this.setState({ pointDrag: true, dragRect: rectIndex, dragPoint: pointIndex, dragTimeIndex: timeIndex });
        }
      }
    } else if (event.target.nodeName === 'rect') {
      // Event for dragging existing box

      const splits = event.target.id.split('--');
      if (splits.length >= 2) {
        let timeIndex = parseInt(splits[1], 10);
        let rectIndex = parseInt(splits[0], 10);

        this.setState({ selectedObjAnnotation: this.state.annotations[rectIndex], rectDrag: true, dragRect: rectIndex, dragTimeIndex: timeIndex, dragPoint: [event.offsetX, event.offsetY] });
      }
    }
  }
  mousemoveHandle(event) {

    // If mouse is holding box corner
    if (this.state.pointDrag) {
      let currentRect = this.state.annotations[this.state.dragRect].value;

      const newx = getPoint(event.offsetX / this.state.videoWidth);
      const newy = getPoint(event.offsetY / this.state.videoHeight);

      // this.state.dragPoint 0 = tl, 1 = tr, 2 = bl, 3 = br
      if (this.state.dragPoint === 0) {
        currentRect.tlx = newx;
        currentRect.tly = newy;
      } else if (this.state.dragPoint === 1) {
        currentRect.brx = newx;
        currentRect.tly = newy;
      } else if (this.state.dragPoint === 2) {
        currentRect.tlx = newx;
        currentRect.bry = newy;
      } else if (this.state.dragPoint === 3) {
        currentRect.brx = newx;
        currentRect.bry = newy;
      }
      //this.state.annotations[this.state.dragRect].value = currentRect;
      //this.setState({ annotations:this.state.annotations });

      this.setState(prevState => ({
        annotations: prevState.annotations.map((itm,idx) => idx === this.state.dragRect ? { ...itm, value: currentRect } : itm).sort((a,b) => a.frame - b.frame)
      }))
    } else if (this.state.rectDrag) {
      // If mouse is holding middle of box

      const dx = (event.offsetX - this.state.dragPoint[0]) / this.state.videoWidth;
      const dy = (event.offsetY - this.state.dragPoint[1]) / this.state.videoHeight;
      let currentRect = this.state.annotations[this.state.dragRect].value;

      currentRect.tlx = getPoint(currentRect.tlx+dx);
      currentRect.tly = getPoint(currentRect.tly+dy);
      currentRect.brx = getPoint(currentRect.brx+dx);
      currentRect.bry = getPoint(currentRect.bry+dy);

      this.state.annotations[this.state.dragRect].value = currentRect;
      this.setState({ annotations:this.state.annotations, dragging: true, dragPoint: [event.offsetX, event.offsetY] });
    } else if (this.state.newBox.length > 0) {
      // If mouse is holding down to create new box

      let newBox = this.state.newBox;
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

      if (newBox.length === 1) {
        newBox.push([x,y]);
      } else {
        newBox[1] = [x,y];
      }
      this.setState({ newBox });
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
      annotationObj.frame = this.getCurrentFrame();
      annotationObj.type = 'object';
      annotationObj.label = this.state.selectedObjLabel.label;
      annotationObj.persist = false;
      //annotationObj.color = this.state.selectedObjLabel.color;
      annotationObj.value = {tlx,tly,brx,bry};

      const annotations = this.state.annotations;
      annotations.push(annotationObj);

      this.setState({
        annotations,
        selectedObjAnnotation: annotationObj,//this.state.selectedObjLabel.label,
        selectedObjLabel: {},
        newBox: [],
        mouseDown: false,
        newBoxDrag: false
      });
    }
    // If mouse had been holding down a point
    else if (this.state.pointDrag) {
      let currentRect = this.state.annotations[this.state.dragRect].value;

      let newPoint = this.makePointInBoundaries(event.offsetX, event.offsetY);
      const newx = getPoint(newPoint.x / this.state.videoWidth);
      const newy = getPoint(newPoint.y / this.state.videoHeight);

      // this.state.dragPoint 0 = tl, 1 = tr, 2 = bl, 3 = br
      if (this.state.dragPoint === 0) {
        currentRect.tlx = newx;
        currentRect.tly = newy;
      } else if (this.state.dragPoint === 1) {
        currentRect.brx = newx;
        currentRect.tly = newy;
      } else if (this.state.dragPoint === 2) {
        currentRect.tlx = newx;
        currentRect.bry = newy;
      } else if (this.state.dragPoint === 3) {
        currentRect.brx = newx;
        currentRect.bry = newy;
      }
      this.state.annotations[this.state.dragRect].value = currentRect;
      this.setState({ annotations:this.state.annotations, pointDrag: false });
    } else if (this.state.rectDrag) {
      // If mouse had been holding down middle of a box

      // If mouse moved while holding down box
      if (this.state.dragging) {
        const dx = (event.offsetX - this.state.dragPoint[0]) / this.state.videoWidth;
        const dy = (event.offsetY - this.state.dragPoint[1]) / this.state.videoHeight;


        let currentRect = this.state.annotations[this.state.dragRect].value;

        currentRect.tlx = getPoint(currentRect.tlx+dx);
        currentRect.tly = getPoint(currentRect.tly+dy);
        currentRect.brx = getPoint(currentRect.brx+dx);
        currentRect.bry = getPoint(currentRect.bry+dy);

        this.state.annotations[this.state.dragRect].value = currentRect;
        this.setState({ annotations:this.state.annotations, dragging: false, rectDrag: false, dragPoint: undefined, dragRect: undefined, dragTimeIndex: undefined });
      } else {
        // Mouse did not move while holding down box (just clicked on it)

        this.setState({ dragging: false, rectDrag: false, dragRect: undefined });
      }
    }
  }
  selectLabel(labelObj, value, e) {
    if (this.state.selectedObjLabel.label !== labelObj.label || this.state.selectedObjLabel.value !== value) {
      let selLabel = {label:labelObj.label,value:value,color:labelObj.color,type:labelObj.type,persist:labelObj.persist};
      this.setState({ selectedObjLabel: selLabel });
    } else {
      this.setState({ selectedObjLabel: {} });
    }
  }
  toggleLabel(labelObj,value,e) {
    const idx = findIndex(this.state.annotations, (itm) => { return (itm.frame === this.getCurrentFrame()) && (itm.label === labelObj.label); })
    // If label on frame exists
    if (idx > -1) {
      // If values are the same
      if (this.state.annotations[idx].value === value) {
        // Delete annotation
        this.state.annotations.splice(idx,1);
        this.setState({
          annotations: this.state.annotations
        })
      } else {
        // If values are different
        // Change value of annotation
        this.state.annotations[idx].value = value;
        this.setState({
          annotations:this.state.annotations
        })
      }
    } else {
      // Create annotation
      let annotationObj = {};
      annotationObj.frame = this.getCurrentFrame();
      annotationObj.type = labelObj.type;
      annotationObj.label = labelObj.label;
      annotationObj.persist = labelObj.persist;
      // annotationObj.color = labelObj.color;
      annotationObj.value = value;
      this.state.annotations.push(annotationObj);
      this.setState({
        annotations:this.state.annotations
      })
    }
  }
  addLabel(e) {
    const label = this.state.newObjLabelText;
    var labelObj = {};
    labelObj.type = 'object';
    labelObj.label = label;
    labelObj.persist = false;
    labelObj.values = ['BOX'];

    var objList = this.state.labels.filter((itm) => itm.type === 'object');
    if (objList.length < this.state.colors.length) {
      labelObj.color = this.state.colors[objList.length];
      this.setState(prevState => ({
        labels: [...prevState.labels, labelObj],
        newObjLabelText: ''
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
    //this.state.labels[editingObjLabelIndex].label = this.state.newObjLabelText;
    this.setState(prevState => ({
      labels: prevState.labels.map((itm,idx) => { return idx === index ? { ...itm, label: value } : itm }),
      editingObjLabelIndex: -1,
      newObjLabelText: ''
    }))
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

    // if a box annotation was selected
    if (this.state.selectedObjAnnotation.label) {
      var origLabel = this.state.selectedObjAnnotation.label;
      //var origColor = this.getColorFromLabel(this.state.selectedObjAnnotation.label);
      var newLabel = labelObj.label;
      //var newColor = labelObj.color;

      // Get every box annotation that is current frame or later, and sort them by frame and secondarily by origLabel vs not origLabel
      var annotationsToCheck = this.state.annotations.filter((itm) => { return itm.frame >= frame && itm.type === 'object'; }).sort((a,b) => { return (a.frame - b.frame) || (b.label === origLabel ? 1 : (a.label === origLabel ? -1 : 0)); });

      var changedAnnotations = [];
      var changedFrames = [];

      var currentFrame = -1;

      for (let i=0;i<annotationsToCheck.length;i++) {
        // If new frame is being looked at
        if (currentFrame !== annotationsToCheck[i].frame) {
          // This first new frame is guaranteed to be the orig frame or it doesn't exist
          if (annotationsToCheck[i].label !== origLabel) {
            // No more origLabels to change, stop
            break;
          }

          currentFrame = annotationsToCheck[i].frame;
        }

        // Change origLabel to new label or new label to origLabel
        if (annotationsToCheck[i].label === origLabel) {
          annotationsToCheck[i].label = newLabel;
          //annotationsToCheck[i].color = newColor;
          changedAnnotations.push(annotationsToCheck[i]);
          changedFrames.push(annotationsToCheck[i].frame);
        } else if (annotationsToCheck[i].label === newLabel) {
          annotationsToCheck[i].label = origLabel;
          //annotationsToCheck[i].color = origColor;
          changedAnnotations.push(annotationsToCheck[i]);
          changedFrames.push(annotationsToCheck[i].frame);
        }
      }
    }

    // Take annotationsToCheck and shove that into annotations

    // Only keep annotations that are either not part of the changed frames, or if they are, their label isnt the old or new one
    // Then, concat with all new annotations
    this.setState(prevState => ({
      annotations: prevState.annotations.filter((itm) => { return (changedFrames.indexOf(itm.frame) > -1) ? (itm.label !== origLabel && itm.label !== newLabel) : true; }).concat(changedAnnotations)
    }))

  }
  renderObjLabels() {
    return ( <div>
      <div style={{margin:6}}>
        <Input size="mini" value={this.state.newObjLabelText} onChange={(event) => this.setState({newObjLabelText: event.target.value })} placeholder="Enter label..." />
        <Button title="Add" icon size="mini" style={{marginLeft:6}} onClick={this.state.editingObjLabelIndex > -1 ? this.editObjLabel.bind(this) : this.addLabel.bind(this)}> <Icon name="plus" /></Button>
      </div>
      <div style={{ display: 'flex', backgroundColor: 'white', overflow: 'auto', flexDirection: 'column', height: '200px'}}>
        {this.state.labels.map((item,index) => {

          if (item.type !== 'object') return null;

          return <div>
            <div className="disable_text_highlighting text-center" onClick={this.setEditingObjLabel.bind(this,index,item.label)} key={item.label+index} id={item.label+index} style={{ cursor: 'pointer', padding: 6, display:'inline-block' }}>
              <div style={{ cursor: 'pointer', color:'white' }}>
                <Label id={item.label+index+'label'} size="small" style={{ boxShadow: '1px 1px 1px', color: 'white', backgroundColor: item.color }}>{'E'}</Label>
              </div>
            </div>
            <div className="disable_text_highlighting" key={item.label+'header'} id={item.label+'header'} style={{ padding: 12, display:'inline-block',backgroundColor: this.state.editingObjLabelIndex === index ? '#f48fb1' : 'white' }}>
              {item.label}
            </div>
            {item.values.map((item2,index2) => {
              let bgC = 'white';
              if (this.state.selectedObjLabel.label === item.label && this.state.selectedObjLabel.value === item2) {
                bgC = 'grey';
              }

              const idx = findIndex(this.state.annotations, (itm) => { return (itm.frame === this.getCurrentFrame()) && (itm.label === item.label); })
              let bgLabel = item.color;
              let func = this.selectLabel.bind(this, item,item2);
              if (idx > -1) {
                bgLabel = 'grey';
                func = null;
              }

              return [<div className="disable_text_highlighting text-center" onClick={func} key={item.label+index} id={item.label+index} style={{ cursor: 'pointer', backgroundColor: bgC, padding: 6, display:'inline-block' }}>
                <div style={{ cursor: 'pointer', color:'white' }}>
                  <Label id={item.label+index+'label'} size="small" style={{ boxShadow: '1px 1px 1px', color: 'white', backgroundColor: bgLabel }}>{'+'}</Label>
                </div>
              </div>,<div className="disable_text_highlighting text-center" onClick={this.changeMultiple.bind(this,item)} key={item.label+index+'2'} id={item.label+index+'2'} style={{ cursor: 'pointer', backgroundColor: 'white', padding: 6, display:'inline-block' }}>
                <div style={{ cursor: 'pointer', color:'white' }}>
                  <Label id={item.label+index+'label2'} size="small" style={{ boxShadow: '1px 1px 1px', color: 'white', backgroundColor: item.color }}>{'Ch'}</Label>
                </div>
              </div>]
            })}
          </div>
        })}
      </div>
    </div>);
  }
  renderClassLabels() {
    const arrs = [];
    const labels = this.state.labels.filter((itm) => { return itm.type === 'class' });
    for (let i=0;i<labels.length;i++) {
      //arrs.push(<Label)
      arrs.push(<div>
        <div className="disable_text_highlighting" key={labels[i].label+'header'} id={labels[i].label+'header'} style={{ padding: 6, display:'inline-block' }}>
          {labels[i].label}
        </div>
        {labels[i].values.map((item,index) => {
          let bgC = 'white';
          if (this.state.selectedObjLabel.label === labels[i].label && this.state.selectedObjLabel.value === item) {
            bgC = 'grey';
          }

          const idx = findIndex(this.state.annotations, (itm) => { return (itm.frame === this.getCurrentFrame()) && (itm.label === labels[i].label) && (itm.value === item); })
          if (idx > -1) {
            bgC = 'grey';
          }

          let func = this.toggleLabel;

          let s = item;
          if (s === true) {
            s = 'Start';
          }
          if (s === false) {
            s = 'End';
          }

          return <div className="disable_text_highlighting" onClick={func.bind(this, labels[i],item)} key={labels[i].label+index} id={labels[i].label+index} style={{ cursor: 'pointer', backgroundColor: bgC, padding: 6, display:'inline-block' }}>
            <div style={{ cursor: 'pointer', color:'white' }}>
              <Label id={labels[i].label+index+'label'} size="small" style={{ boxShadow: '1px 1px 1px', color: 'white', backgroundColor: labels[i].color }}>{s}</Label>
            </div>
          </div>
        })}
      </div>)
    }
    return ( <div>
      {/*<div style={{margin:6}}>
        <Input size="mini" value={this.state.newClassLabelText} onChange={(event) => this.setState({newClassLabelText: event.target.value })} placeholder="Enter label..." />
        <Button title="Add" icon size="mini" style={{marginLeft:6}} onClick={this.addLabel.bind(this,this.state.newClassLabelText)}> <Icon name="plus" /></Button>
      </div>*/}
      <div style={{ backgroundColor: 'white', overflow: 'auto', height: '200px'}}>
        {arrs}
      </div>
    </div>);
  }
  renderBoxes(data, event) {
    if (!this.state.player.paused) {
      if (!this.state.rfa) {
        this.setState({
          rfa: true
        })
        window.requestAnimationFrame((ts) => { 
          this.setState({
            animationStartTime: ts
          })
          this.increasePlayerTime(ts); 
        });
      }
      return (null);
    }
    return this.state.annotations.map((rect, index) => {
      if (rect.type !== 'object') return null;

      if (rect.frame !== this.getCurrentFrame()) return null;
      
      const lineColor = this.getColorFromLabel(rect.label);
      const sw = 2 / this.state.scale;

      let id = index + '--' + this.state.player.currentTime;

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

      let color = this.getColorFromLabel(rect.label);
      //color = 'rgb(80, 90, 206)';

      let swp = 1;
      let radius = 0.5;
      let style = {};

      if (this.state.newBox.length === 0) {
        style = { cursor: '-webkit-grabbing'};
      }
      if (this.state.selectedObjAnnotation.label === rect.label) {
        swp = 4 / this.state.scale;
        radius = 4 / this.state.scale;
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
        {points.map((item,index2) => {
          const idp = index + '--' + index2 + '--' + this.state.player.currentTime;
          return <circle style={style} id={idp} cx={item[0]}
                    cy={item[1]}
                  r={radius} stroke="white" strokeWidth={swp} fill={lineColor} />
        })}
      </g>
      ];
    })
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
      return (<rect x={x} y={y} width={width} height={height} style={{fill: `${color}`, fillOpacity: this.state.opacity, stroke: color, strokeWidth: `${2 / this.state.scale}`}} />);
    }
    return null;
  }
  renderAnnotationTimelineObj() {
    // Render all annotations below video

    return <div style={{position:'relative',display:'block'}}>
    {this.state.annotations.map((item, index) => {
      const color = this.getColorFromLabel(item.label);

      let label = item.label;
      let value = item.value;

      const yOffset = findIndex(this.state.labels,(i) => {
        return i.label === label;
      })

      let left = item.frame/Math.round(this.state.player.duration*this.state.fps);

      return (<div onClick={this.seekAndSelect.bind(this,item)} style={{width:4,height:12,backgroundColor:color,cursor:'pointer',position:'absolute',top:yOffset*12,left:(left*100)+'%'}}>
        {/*label+(item.type === 'class' ? '-'+value : '')*/}
      </div>);
      /*return (<Label onClick={this.seekAndSelect.bind(this,item)} style={{backgroundColor:color,color:'white',cursor:'pointer',position:'absolute',top:yOffset*18,left:(left*100)+'%'}} size="mini">
        {label+(item.type === 'class' ? '-'+value : '')}
      </Label>);*/
    })}
    </div>
  }
  renderAnnotationTimelineClass() {
    // Render all annotations below video

    return <div style={{position:'relative',display:'block'}}>
    {this.state.annotations.map((item, index) => {
      const color = this.getColorFromLabel(item.label);

      let label = item.label;
      let value = item.value;

      const yOffset = findIndex(this.state.labels,(i) => {
        return i.label === label;
      })

      let left = item.frame/Math.round(this.state.player.duration*this.state.fps);

      return (<div onClick={this.seekAndSelect.bind(this,item)} style={{width:4,height:12,backgroundColor:color,cursor:'pointer',position:'absolute',top:yOffset*12,left:(left*100)+'%'}}>
        {/*label+(item.type === 'class' ? '-'+value : '')*/}
      </div>);
      /*return (<Label onClick={this.seekAndSelect.bind(this,item)} style={{backgroundColor:color,color:'white',cursor:'pointer',position:'absolute',top:yOffset*18,left:(left*100)+'%'}} size="mini">
        {label+(item.type === 'class' ? '-'+value : '')}
      </Label>);*/
    })}
    </div>
  }
  renderBuffers() {
    return <div style={{position:'relative',display:'block'}}>
    {this.state.buffers.map((item, index) => {
      const color = '#f00';

      let start = item[0]/this.state.player.duration;
      let end = item[1]/this.state.player.duration;
      let width = (item[1]-item[0])/this.state.player.duration;

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
    //console.log('remove',event.target.id);
    //console.log(this.state.selectedObjAnnotation);
    const idx = findIndex(this.state.annotations,(item) => { return this.state.selectedObjAnnotation.label === item.label && item.frame === this.getCurrentFrame()});

    if (idx > -1) {
      this.state.annotations.splice(idx, 1);
      this.setState({
        annotations: this.state.annotations
      })
    }
  }
  exportJson(e) {
    var exportObj = {};
    exportObj.content = this.state.video;
    exportObj.width = this.state.origVideoWidth;
    exportObj.height = this.state.origVideoHeight;
    exportObj.fps = this.state.fps;
    exportObj.labels = this.state.labels;
    exportObj.annotations = this.state.annotations;

    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    //var dlAnchorElem = document.getElementById('downloadAnchorElem');
    var dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href",     dataStr     );
    dlAnchorElem.setAttribute("download", "export.json");
    document.body.appendChild(dlAnchorElem); // Required for FF
    dlAnchorElem.click();
  }
  onReaderLoad(e) {
    console.log(e.target.result);
    var obj = JSON.parse(e.target.result);
    //console.log(obj);
    for (var i=0;i<obj.labels.length;i++) {
      obj.labels[i].color = this.state.colors[i];
    }
    for (var i=0;i<obj.annotations.length;i++) {
      obj.annotations[i].value.brx *= obj.width;
      obj.annotations[i].value.bry *= obj.height;
      obj.annotations[i].value.tlx *= obj.width;
      obj.annotations[i].value.tly *= obj.height;
    }
    this.setState({
      video: obj.content,
      origVideoHeight: obj.height,
      origVideoWidth: obj.width,
      fps: obj.fps,
      labels: obj.labels,
      annotations: obj.annotations,
      canvasSet: false,
      videoLoad: false
    })
    this.player.source = obj.content;
    this.DrawBoard = null;
    //alert_data(obj.name, obj.family);
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

    console.log(this.state.labels);

    const canvasStyles = {
      zIndex: this.state.mouseDown ? 4 : 2,
      position: 'absolute',
      display: 'block',
      top: 0,
      left: 0,
      marginTop: this.state.marginTop,
      marginLeft: this.state.marginLeft,
      width: this.state.player ? this.state.videoWidth : 0,
      height: this.state.player ? this.state.videoHeight : 0,
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
        this.setVolume(this.state.defaultVolume);
        this.changePlaybackRateRate(this.state.defaultPlaybackRate);
      }
    };

    let combo = undefined;
    if (this.state.player && this.state.player.paused) {
      Mousetrap.bind('space', this.play.bind(this));
    } else if (this.state.player) {
      Mousetrap.bind('space', this.pause.bind(this));
    }
    if ('forward' in shortcuts) {
      combo = convertKeyToString(shortcuts.forward);
      if (this.state.player && this.state.player.paused) {
        Mousetrap.bind(combo, this.seekRelative.bind(this, 1 / this.state.fps));
      } else if (this.state.player) {
        Mousetrap.unbind(combo);
      }
    }
    if ('backward' in shortcuts) {
      combo = convertKeyToString(shortcuts.backward);
      if (this.state.player && this.state.player.paused) {
        Mousetrap.bind(combo, this.seekRelative.bind(this, - 1 / this.state.fps));
      } else if (this.state.player) {
        Mousetrap.unbind(combo);
      }
    }
    if ('fast_forward' in shortcuts) {
      combo = convertKeyToString(shortcuts.fast_forward);
      if (this.state.player && this.state.player.paused) {
        Mousetrap.bind(combo, this.seekRelative.bind(this, 600 / this.state.fps));
      } else if (this.state.player) {
        Mousetrap.unbind(combo);
      }
    }
    if ('fast_backward' in shortcuts) {
      combo = convertKeyToString(shortcuts.fast_backward);
      if (this.state.player && this.state.player.paused) {
        Mousetrap.bind(combo, this.seekRelative.bind(this, -600 / this.state.fps));
      } else if (this.state.player) {
        Mousetrap.unbind(combo);
      }
    }
    if ('delete' in this.props.shortcuts) {
      combo = convertKeyToString(this.props.shortcuts.delete);
      Mousetrap.bind(combo, this.removeBox.bind(this));
    }

    return (<div>
      <div style={{margin:12}}>
        <input className="file-input" type="file" name="list" onChange={this.importJson.bind(this)} />
        <Button title="Export" size="mini" onClick={this.exportJson.bind(this)}>Export</Button>
      </div>
        
      <div style={{ lineHeight: 0, display: 'flex', flexDirection: 'row', justifyContent: 'space-around'}}>
        <div style={{ display: 'flex', flexDirection: 'column'}}>
          <div>
            <div style={{ lineHeight: 0, display: 'block', position: 'relative' }}>
              <div className="pan-zoom-element" style={{width: this.state.windowWidth, height: this.state.windowHeight}}>
                <div className="content-container noselect" style={{ transform: `translate(${this.state.translate.x}px, ${this.state.translate.y}px) scale(${this.state.scale})`, transformOrigin: '0 0', position: 'relative' }}>
                  <video
                    ref={(player) => { this.player = player; }}
                    aspectratio="16:9"
                    onLoadedMetadata={(e1, e2, e3) => {
                      const { width, height } = this.videoDimensions(this.player);
                      let marginLeft = 0;
                      let marginTop = 0;
                      if (height !== this.state.windowHeight) {
                        marginTop = Math.abs(height - this.state.windowHeight) / 2;
                      }
                      if (width !== this.state.windowWidth) {
                        marginLeft = Math.abs(width - this.state.windowWidth) / 2;
                      }
                      this.setState({ videoLoad: true, videoHeight: height, marginTop, marginLeft, videoWidth: width });
                    }}
                    onLoadStart={this.handleStateChange.bind(this, 'onLoadStart')}
                    onWaiting={this.handleStateChange.bind(this, 'onWaiting')}
                    onCanPlay={this.handleStateChange.bind(this, 'onCanPlay')}
                    onCanPlayThrough={this.handleStateChange.bind(this, 'onCanPlayThrough')}
                    onPlaying={this.handleStateChange.bind(this, 'onPlaying')}
                    onEnded={this.handleStateChange.bind(this, 'onEnded')}
                    onSeeking={this.handleStateChange.bind(this, 'onSeeking')}
                    onSeeked={this.handleStateChange.bind(this, 'onSeeked')}
                    onPlay={this.handleStateChange.bind(this, 'onPlay')}
                    onPause={this.handleStateChange.bind(this, 'onPause')}
                    onProgress={this.handleStateChange.bind(this, 'onProgress')}
                    onDurationChange={this.handleStateChange.bind(this, 'onDurationChange')}
                    onError={this.handleStateChange.bind(this, 'onError')}
                    onSuspend={this.handleStateChange.bind(this, 'onSuspend')}
                    onAbort={this.handleStateChange.bind(this, 'onAbort')}
                    onEmptied={this.handleStateChange.bind(this, 'onEmptied')}
                    onStalled={this.handleStateChange.bind(this, 'onStalled')}
                    onLoadedData={this.handleStateChange.bind(this, 'onLoadedData')}
                    onTimeUpdate={this.handleStateChange.bind(this, 'onTimeUpdate')}
                    onRateChange={this.handleStateChange.bind(this, 'onRateChange')}
                    onVolumeChange={this.handleStateChange.bind(this, 'onVolumeChange')}
                    width={this.state.windowWidth} height={this.state.windowHeight}
                    preload="auto"
                    fluid={false}
                    src={this.state.video} />
                      { !this.state.videoLoad && <Dimmer active>
                                                <Loader />
                                              </Dimmer>}
                        { this.state.videoLoad &&
                          <div ref={(canv) => { this.canvas = canv; setFunctions();}} style={canvasStyles}>
                            { this.canvas && this.canvas.offsetWidth &&
                                  <svg id="drawing" ref={(id) => {  this.svgId = id }} style={{ width: this.state.videoWidth, height: this.state.videoHeight }}>
                                    {this.renderBoxes()}
                                    {this.state.newBox && this.state.newBox.length > 0 && this.canvas && this.renderNewBox()}
                                    {/*this.state.player.paused && this.state.newBox.length > 1 && this.renderPointsForNewBox()*/}
                                  </svg>
                            }
                          </div>
                        }
                      </div>
                    </div>
              </div>
        </div>
          {this.state.videoLoad &&
            <div>
              <div style={{display:'block',textAlign:'center'}}>
                <Button title="Fast Backward" icon size="mini" onClick={this.seekRelative.bind(this, -600 / this.state.fps)}> <Icon name="fast backward" /></Button>
                <Button title="Backward" icon size="mini" onClick={this.seekRelative.bind(this, -1 / this.state.fps)}> <Icon name="backward" /></Button>
                {this.state.player.paused &&
                            <Button title="Play" icon size="mini" onClick={this.play}> <Icon name="play" /></Button>}
                {!this.state.player.paused &&
                  <Button title="Pause" icon size="mini" onClick={this.pause}> <Icon name="pause" /></Button>}
                <Button title="Forward" icon size="mini" onClick={this.seekRelative.bind(this, 1 / this.state.fps)}> <Icon name="forward" /></Button>
                <Button title="Fast Forward" icon size="mini" onClick={this.seekRelative.bind(this, 600 / this.state.fps)}> <Icon name="fast forward" /></Button>
              </div>
              <div style={{display:'block',textAlign:'center'}}>
                { this.state.player.paused &&
                  <p ref={ (ptext) => this.ptext = ptext} id="progressBarText" className="text-center" style={{ fontSize: 'small'}}>
                    {this.state.player.currentTime} / {this.state.player.duration}
                  </p>
                }
                { !this.state.player.paused &&
                  <p ref={ (ptext) => this.ptextPlay = ptext} id="progressBarTextPlay" className="text-center" style={{ fontSize: 'small'}}>
                    {this.state.player.currentTime} / {this.state.player.duration}
                  </p>
                }
              </div>
              <input title="PlayBack Rate" style={{display:'inline-block',width:'25%',marginRight:12}} className="ui range" onChange={(event, data) => { console.log('changePlaybackRateRate', event.target.value, data); this.changePlaybackRateRate(parseFloat(event.target.value)); }} min={0.1} step={0.1} max={2} type="range" value={this.state.player.playbackRate} />
              <p style={{display:'inline-block'}}>Playback Speed : <b>{this.state.player.playbackRate}x</b></p>
              {this.renderBuffers()}
              <input id="progressBar" title="Progress" style={{ padding: '2px', display:'block',width:'100%' }} className="ui range" onChange={(event, data) => { console.log('onSeekChange', event.target.value, data); this.seek(event.target.value); }} min={0} step={0.0001} max={this.state.player.duration} type="range" value={this.state.player.currentTime} />
              {this.state.annotations.length > 0 && this.renderAnnotationTimelineObj()}
              {this.state.annotations.length > 0 && this.renderAnnotationTimelineClass()}

            </div>
          }
        </div>
        <div style={{ flexGrow: 1.5 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around'}}>
            <div style={{ position: 'relative', border: '1px solid #eaf2f4', backgroundColor: '#f5f9fa', boxSizing: 'border-box' }}>
              <Label size="mini" attached="top left">
                Objects
              </Label>
              {this.renderObjLabels('object')}
            </div>
            <div style={{ position: 'relative', border: '1px solid #eaf2f4', backgroundColor: '#f5f9fa', boxSizing: 'border-box' }}>
              <Label size="mini" attached="top left">
                Classifications
              </Label>
              {this.renderClassLabels()}
            </div>
          </div>
        </div>
      </div>
    </div>);
  }
}

