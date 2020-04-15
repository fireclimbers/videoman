import React, { Component } from 'react';
import { Button, Label, Icon, Dimmer, Loader, Input } from 'semantic-ui-react';
import { getPoint, convertKeyToString } from './helper';
const Mousetrap = require('mousetrap');

const SVG = require('svg.js');

export default class VideoAnnotator extends Component {
  constructor(props) {
    super(props);
    const fps = 60;
    const { windowWidth, windowHeight } = this.getWindowDimeshions();
    this.state = {
      origVideoWidth: 1920,
      origVideoHeight: 1080,
      fps: fps,
      annotations: [],
      labels: [
        {
          type: 'object',
          label: 'polyp1',
          persist: false,
          values: ['BOX'],
          color: '#e53935'
        },
        {
          type: 'object',
          label: 'polyp2',
          persist: false,
          values: ['BOX'],
          color: '#8e24aa'
        },
        {
          type: 'object',
          label: 'polyp3',
          persist: false,
          values: ['BOX'],
          color: '#3949ab'
        },
        {
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
        }
      ],
      currentBox: [], //values for when drawing new box
      selectedObjLabel: {}, //{label, value (single), color, type, persist}
      animationStartTime: undefined,
      canvasSet: false,
      newLabelText: '',
      translate: {
        x: 0,
        y: 0
      },
      marginTop: 0,
      marginLeft: 0,
      opacity: 0.1,
      defaultPlaybackRate: 1,
      defaultVolume: 0.0,
      scale: 1,
      video: props.video,
      selectedAnnotation: '',
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
    this.load = this.load.bind(this);
    this.seekRelative = this.seekRelative.bind(this);
    this.seek = this.seek.bind(this);
    this.changePlaybackRateRate = this.changePlaybackRateRate.bind(this);
    this.setVolume = this.setVolume.bind(this);
    this.handleStateChange = this.handleStateChange.bind(this);
  }
  componentDidMount() {
    window.addEventListener('resize', this.resizeWindow);

    setTimeout(this.showBuffer.bind(this), 500);

    /*setTimeout(() => {
      let annos = [];
      for (let i=0;i<60*10;i++) {
        annos.push({
          frame: i,
          type: 'object', //object - bounding box, class - single value assigned to frame
          label: 'polyp1',
          persist: false, //if persist = true, label every frame after the same label until a frame with an existing label and different value is found
          color: '#e53935',
          value: {tlx: 0, tly: 0, brx: i/600, bry: i/600}
        })
      }
      this.setState({
        annotations: annos
      })
    }, 5000);*/
  }
  componentWillReceiveProps(nextProps) {
    if (this.props.video !== nextProps.video) {
      this.setState({canvasSet: false, videoLoad: false, video: nextProps.video });
      this.player.source = nextProps.video;
      this.DrawBoard = null;
    }
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeWindow);
  }
  showBuffer(e) {
    if (this.state.player && this.state.player.buffered) {
      let buffers = [];
      for (let i=0;i<this.state.player.buffered.length;i++) {
        buffers.push([this.state.player.buffered.start(i),this.state.player.buffered.end(i)]);
      }
      this.setState({
        buffers
      })
      //console.log(buffers);
      //console.log(this.state.player.buffered);
      //this.setState({

      //})
    }
    setTimeout(this.showBuffer.bind(this), 500);
  }
  getWindowDimeshions() {
    let windowHeight = (window.innerHeight * 70) / 100;
    let windowWidth = (window.innerWidth * 80) / 100;

    if (this.props.fullScreen) {
      windowHeight = (window.innerHeight * 95) / 100;
      windowWidth = (window.innerWidth * 85) / 100;
    }
    return { windowWidth, windowHeight };
  }
  setVolume(steps) {
    let player = {...this.state.player, volume: steps};
    this.setState({ defaultVolume: steps, player });
  }
  getCoords = (rect) => {
    let x = this.state.videoWidth;
    let y = this.state.videoHeight;
    let xlg = 0;
    let ylg = 0;
    for (let jindex = 0; jindex < rect.length; jindex ++) {
      let currentPoint = rect[jindex];
      let currentx = currentPoint[0];
      let currenty = currentPoint[1];
      if (x > currentx) {
        x = currentx;
      }
      if (y > currenty) {
        y = currenty;
      }
      if (currentx > xlg) {
        xlg = currentx;
      }
      if (currenty > ylg) {
        ylg = currenty;
      }
    }
    let width = Math.abs(xlg - x);
    let height = Math.abs(ylg - y);
    x = x * this.canvas.offsetWidth;
    y = y * this.canvas.offsetHeight;
    width = width * this.canvas.offsetWidth;
    height = height * this.canvas.offsetHeight;
    return { x, y, width, height };
  }
  convertToPoint(x, y) {
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
    window.cancelAnimationFrame(this.increasePlayerTime);
    const player = this.state.player;
    const frame = Math.round(player.currentTime*this.state.fps);
    //console.log(frame);
    const seconds = frame/this.state.fps;
    //console.log(seconds);
    player.currentTime = seconds;
    this.setState({ rfa: false });
    this.state.player.pause();
    this.setState({ player });
    return false;
  }
  load() {
    this.state.player.load();
  }
  seekRelative(seconds) {
    const player = this.state.player;
    const currentTime = player.currentTime;
    this.seek((currentTime + parseFloat(seconds)).toFixed(6));
    return false;
  }
  seek(seconds) {
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
  changePlaybackRateRate(steps) {
    this.state.player.playbackRate = steps;
    this.setState({ defaultPlaybackRate: steps });
  }
  videoDimensions(video) {
    // Ratio of the video's intrisic dimensions
    var videoRatio = video.videoWidth / video.videoHeight;

    var { windowWidth, windowHeight } = this.getWindowDimeshions();
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
      if (!this.state.player.paused && (Math.round(this.state.player.currentTime*this.state.fps) === rect.frame)) {
        const lineColor = rect.color;
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
  mousedownHandle(event) {
    if (!this.state.player.paused) return;

    if (this.state.selectedObjLabel.label) {
      // Event for creating new box (creating first corner and confirming other corner)

      // Deselect all existing boxes
      this.setState({
        selectedAnnotation: ''
      })

      // If creating first corner
      if (this.state.currentBox.length === 0) {
        const currentBox = this.state.currentBox;
        currentBox.push([event.offsetX, event.offsetY]);
        this.setState({
          currentBox,
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
        if (this.state.selectedAnnotation === this.state.annotations[rectIndex].label) {
          this.setState({ pointDrag: true, dragRect: rectIndex, dragPoint: pointIndex, dragTimeIndex: timeIndex });
        }
      }
    } else if (event.target.nodeName === 'rect') {
      // Event for dragging existing box

      const splits = event.target.id.split('--');
      if (splits.length >= 2) {
        let timeIndex = parseInt(splits[1], 10);
        let rectIndex = parseInt(splits[0], 10);

        this.setState({ selectedAnnotation: this.state.annotations[rectIndex].label, rectDrag: true, dragRect: rectIndex, dragTimeIndex: timeIndex, dragPoint: [event.offsetX, event.offsetY] });
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
      this.state.annotations[this.state.dragRect].value = currentRect;
      this.setState({ annotations:this.state.annotations });
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
    } else if (this.state.currentBox.length > 0) {
      // If mouse is holding down to create new box

      let currentBox = this.state.currentBox;
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

      if (currentBox.length === 1) {
        currentBox.push([x,y]);
      } else {
        currentBox[1] = [x,y];
      }
      this.setState({ currentBox });
    }
  }
  mouseupHandle(event) {

    if (this.state.newBoxDrag) {
    // If confirming other corner

      let currentBox = this.state.currentBox;
      const point1 = currentBox[0];
      let point2 = this.convertToPoint(event.offsetX, event.offsetY);
      let tlx = getPoint(Math.min(point1[0],point2.x) / this.state.videoWidth);
      let tly = getPoint(Math.min(point1[1],point2.y) / this.state.videoHeight);
      let brx = getPoint(Math.max(point1[0],point2.x) / this.state.videoWidth);
      let bry = getPoint(Math.max(point1[1],point2.y) / this.state.videoHeight);

      let annotationObj = {};
      annotationObj.frame = Math.round(this.state.player.currentTime*this.state.fps);
      annotationObj.type = 'object';
      annotationObj.label = this.state.selectedObjLabel.label;
      annotationObj.persist = false;
      annotationObj.color = this.state.selectedObjLabel.color;
      annotationObj.value = {tlx,tly,brx,bry};

      const annotations = this.state.annotations;
      annotations.push(annotationObj);

      this.setState({
        annotations,
        selectedAnnotation: this.state.selectedObjLabel.label,
        selectedObjLabel: {},
        currentBox: [],
        mouseDown: false,
        newBoxDrag: false
      });
    }
    // If mouse had been holding down a point
    else if (this.state.pointDrag) {
      let currentRect = this.state.annotations[this.state.dragRect].value;

      let newPoint = this.convertToPoint(event.offsetX, event.offsetY);
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
  rectToStyles(currentRect) {
    const canvas = this.canvas;
    if (!canvas) {
      return (<div />);
    }
    return this.renderCurrentRectangle();
  }
  renderCurrentRectangle() {
    if (this.state.currentBox.length > 1) {
      let x = Math.min(this.state.videoWidth,this.state.currentBox[0][0],this.state.currentBox[1][0]);
      let y = Math.min(this.state.videoHeight,this.state.currentBox[0][1],this.state.currentBox[1][1]);
      let xlg = Math.max(0,this.state.currentBox[0][0],this.state.currentBox[1][0]);
      let ylg = Math.max(0,this.state.currentBox[0][1],this.state.currentBox[1][1]);

      const color = this.state.selectedObjLabel.color;
      
      const width = Math.abs(xlg - x);
      const height = Math.abs(ylg - y);
      return (<rect x={x} y={y} width={width} height={height} style={{fill: `${color}`, opacity: '0.3', stroke: '#1ae04e', strokeWidth: `${1 / this.state.scale}`}} />);
    }
    return null;
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
    const idx = this.findIndex(this.state.annotations, (itm) => { return (itm.frame === Math.round(this.state.player.currentTime*this.state.fps)) && (itm.label === labelObj.label); })
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
      annotationObj.frame = Math.round(this.state.player.currentTime*this.state.fps);
      annotationObj.type = labelObj.type;
      annotationObj.label = labelObj.label;
      annotationObj.persist = labelObj.persist;
      annotationObj.color = labelObj.color;
      annotationObj.value = value;
      this.state.annotations.push(annotationObj);
      this.setState({
        annotations:this.state.annotations
      })
    }
  }
  addLabel() {
    // TODO add label
  }
  renderLabels(type) {
    const arrs = [];
    const labels = this.state.labels.filter((itm) => { return itm.type === type });
    for (let i=0;i<labels.length;i++) {
      arrs.push(labels[i].values.map((item,index) => {
        let bgC = 'white';
        if (this.state.selectedObjLabel.label === labels[i].label && this.state.selectedObjLabel.value === item) {
          bgC = 'grey';
        }

        const idx = this.findIndex(this.state.annotations, (itm) => { return (itm.frame === Math.round(this.state.player.currentTime*this.state.fps)) && (itm.label === labels[i].label) && (itm.value === item); })
        if (idx > -1) {
          bgC = 'grey';
        }

        let func = (type === 'object') ? this.selectLabel : this.toggleLabel;

        return <div className="disable_text_highlighting text-center" onClick={func.bind(this, labels[i],item)} key={labels[i].label+index} id={labels[i].label+index} style={{ cursor: 'pointer', backgroundColor: bgC, padding: 6, display: 'flex', justifyContent: 'space-around' }}>
          <div style={{ cursor: 'pointer', color:'white' }}>
            <Label id={labels[i].label+index+'label'} size="small" style={{ boxShadow: '1px 1px 1px', color: 'white', backgroundColor: labels[i].color }}>{labels[i].label+' '+item}</Label>
          </div>
        </div>
      }))
    }
    return ( <div>
      <div style={{margin:6}}>
        <Input size="mini" value={this.state.newLabelText} onChange={(event) => this.setState({newLabelText: event.target.value })} placeholder="Enter label..." />
        <Button title="Add" icon size="mini" style={{marginLeft:6}} onClick={this.addLabel.bind(this,this.state.newLabelText)}> <Icon name="plus" /></Button>
      </div>
      <div style={{ display: 'flex', backgroundColor: 'white', overflow: 'auto', flexDirection: 'column', height: '200px'}}>
        {arrs}
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

          const idx = this.findIndex(this.state.annotations, (itm) => { return (itm.frame === Math.round(this.state.player.currentTime*this.state.fps)) && (itm.label === labels[i].label) && (itm.value === item); })
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
      <div style={{margin:6}}>
        <Input size="mini" value={this.state.newLabelText} onChange={(event) => this.setState({newLabelText: event.target.value })} placeholder="Enter label..." />
        <Button title="Add" icon size="mini" style={{marginLeft:6}} onClick={this.addLabel.bind(this,this.state.newLabelText)}> <Icon name="plus" /></Button>
      </div>
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

      if (rect.frame !== Math.round(this.state.player.currentTime*this.state.fps)) return null;
      
      const lineColor = rect.color;
      const sw = 1 / this.state.scale;

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

      let color = '#1ae04e';
      color = 'rgb(80, 90, 206)';

      let swp = 1;
      let radius = 0.5;
      let style = {};

      if (this.state.currentBox.length === 0) {
        style = { cursor: '-webkit-grabbing'};
      }
      if (this.state.selectedAnnotation === rect.label) {
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
  renderCurrentPoints() {
    let lineColor = 'lightblue';
    if (this.state.selectedObjLabel) {
      lineColor = this.state.selectedObjLabel.color;
    }
    const sw = 2;
    const radius = 1;
    const box = this.state.currentBox;
    const tl = [box[0][0], box[0][1]]
    const tr = [box[1][0], box[0][1]]
    const bl = [box[0][0], box[1][1]]
    const br = [box[1][0], box[1][1]]
    const points = [tl,tr,bl,br];
    return <g>
      {points.map((item,index) => {
        const id = 'x' + '-' + index;
        return <circle id={id} cx={item[0]}
                  cy={item[1]}
                r={radius / this.state.scale} stroke="white" strokeWidth={sw / this.state.scale} fill={lineColor} />
      })}
    </g>
  }
  findIndex(list, func) {
    return list.indexOf(list.filter(func)[0]);
  }
  renderAnnotations() {
    return <div style={{position:'relative',display:'block'}}>
    {this.state.annotations.map((item, index) => {
      const color = item.color;

      let label = item.label;
      let value = item.value;

      const yOffset = this.findIndex(this.state.labels,(i) => {
        return i.label === label;
      })

      let left = item.frame/Math.round(this.state.player.duration*this.state.fps);

      return (<Label onClick={this.seekAndSelect.bind(this,item.frame,item.label,item.type)} style={{backgroundColor:color,color:'white',cursor:'pointer',position:'absolute',top:yOffset*18,left:(left*100)+'%'}} size="mini">
        {label+(item.type === 'class' ? '-'+value : '')}
      </Label>);
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
  seekAndSelect(time, key, type) {
    this.seek((time/this.state.fps).toFixed(6));
    if (this.state.selectedAnnotation !== key && type === 'object') {
      this.setState({ selectedAnnotation: key });
    }
  }
  removeBox(event) {
    console.log('remove',event.target.id);
    console.log(this.state.selectedAnnotation);
    const idx = this.findIndex(this.state.annotations,(item) => { return this.state.selectedAnnotation === item.label && item.frame === Math.round(this.state.player.currentTime*this.state.fps)});

    if (idx > -1) {
      this.state.annotations.splice(idx, 1);
      this.setState({
        annotations: this.state.annotations
      })
    }
  };
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

    if (this.props.shortcuts) {
      let combo = undefined;
      const shortcuts = this.props.shortcuts;
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
          Mousetrap.bind(combo, this.seekRelative.bind(this, 10 / this.state.fps));
        } else if (this.state.player) {
          Mousetrap.unbind(combo);
        }
      }
      if ('fast_backward' in shortcuts) {
        combo = convertKeyToString(shortcuts.fast_backward);
        if (this.state.player && this.state.player.paused) {
          Mousetrap.bind(combo, this.seekRelative.bind(this, -10 / this.state.fps));
        } else if (this.state.player) {
          Mousetrap.unbind(combo);
        }
      }
      if ('delete' in this.props.shortcuts) {
        combo = convertKeyToString(this.props.shortcuts.delete);
        Mousetrap.bind(combo, this.removeBox.bind(this));
      }
    }

    return (
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
                                  {this.state.currentBox && this.state.currentBox.length > 0 && this.rectToStyles(this.state.currentBox)}
                                  {this.state.player.paused && this.state.currentBox.length > 1 && this.renderCurrentPoints()}
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
            {this.state.annotations.length > 0 && this.renderAnnotations()}

          </div>
        }
      </div>
      <div style={{ flexGrow: 1.5 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around'}}>
          <div style={{ position: 'relative', border: '1px solid #eaf2f4', backgroundColor: '#f5f9fa', boxSizing: 'border-box' }}>
            <Label size="mini" attached="top left">
              Objects
            </Label>
            {this.renderLabels('object')}
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
    );
  }
}

