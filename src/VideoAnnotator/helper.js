export const getPoint = (point) => {
    //console.log('point is', point);
    if (point < 0.0) { return 0.0; }
    if (point > 1.0) { return 1.0; }
    return point;
  }

export const convertKeyToString = shortcut => {
  const qualifier = shortcut.qualifier;
  const key = shortcut.key;
  if (qualifier.length > 0) {
    return qualifier + "+" + key;
  } else if (qualifier.length === 0) {
    return key;
  }
};

export const getWindowDimeshions = () => {
  let windowHeight = (window.innerHeight * 70) / 100;
  let windowWidth = (window.innerWidth * 80) / 100;

  /*if (this.props.fullScreen) {
    windowHeight = (window.innerHeight * 95) / 100;
    windowWidth = (window.innerWidth * 85) / 100;
  }*/
  return { windowWidth, windowHeight };
}

export const findIndex = (list, func) => {
  return list.indexOf(list.filter(func)[0]);
}

export const videoDimensions = (video) => {
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

export const frameEmpty = (obj) => {
  return !obj || Object.keys(obj).length === 0;
}

export const loop = (obj, func) => {
  const keys = Object.keys(obj);
  for (var prop in keys) {
    if (!obj.hasOwnProperty(prop)) continue;
    //Do your logic with the property here
    func(obj[prop], prop);
  }
}


export const shortcuts = {
        forward: {
          qualifier: "",
          key: "."
        },
        backward: {
          qualifier: "",
          key: ","
        },
        fast_forward: {
          qualifier: "",
          key: "right"
        },
        fast_backward: {
          qualifier: "",
          key: "left"
        },
        delete: {
          qualifier: "",
          key: "backspace"
        }
      }