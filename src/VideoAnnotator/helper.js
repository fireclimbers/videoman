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