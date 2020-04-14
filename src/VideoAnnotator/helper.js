export const getPoint = (point) => {
    console.log('point is', point);
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