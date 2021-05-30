// Geometry layer styling
const myStyle = {
  default: {
    color: "#70a641",
    fillColor: "#7eba49",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.6
  },
  selected: {
    color: "white",
    weight: 2,
    color: "#53ad5c",
    fillColor: "#4aff5c",
    opacity: 0.6,
    fillOpacity: 0.6
  },
  highlight: {
    weight: 2,
    color: "#8cc3d1",
    fillColor: "#abeeff"
  },
  selectAndHighlight: {
    weight: 2,
    color: "#8b4596",
    fillColor: "#d234eb"
  },
  csaChoro(feature) {
    return {
      fillColor: myStyle.getChoroColorCSA(feature.properties.csa_pct),
      weight: 2,
      opacity: 0.6,
      color: "#454545",
      fillOpacity: 0.6
    }
  },
  impervChoro(feature) {
    return {
      fillColor: myStyle.getChoroColorImperv(feature.properties.impervious_pct),
      weight: 2,
      opacity: 0.6,
      color: "#454545",
      fillOpacity: 0.6
    }
  },
  interceptors: {
    color: "#333333",
    dashArray: "5"
  },
  outfalls: {
    radius: 1,
    color: "sienna",
    fillColor: "sienna",
    pane: "pointsPane"
  },
  sewersheds() {
    return {
      weight: 2,
      opacity: 1,
      color: "white",
      fillOpacity: 0.7,
      fillColor:
        "#" + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
    }
  },
  sewerAreas(feature) {
    return {
      fillColor: myStyle.getSewerColor(feature.properties.sewer_type),
      weight: 2,
      opacity: 0.7,
      color: "#454545",
      fillOpacity: 0.6
    }
  },
  getChoroColorCSA(prop) {
    let color
    color =
      prop > 0.948
        ? "#440154"
        : prop > 0.861
        ? "#443a83"
        : prop > 0.738
        ? "#31688e"
        : prop > 0.554
        ? "#20908d"
        : prop > 0.273
        ? "#35b779"
        : prop > 0.072
        ? "#8fd744"
        : "#fde725"
    return color
  },
  getChoroColorImperv(prop) {
    let color
    color =
      prop > 0.829
        ? "#d7191c"
        : prop > 0.756
        ? "#f17c4a"
        : prop > 0.67
        ? "#fec980"
        : prop > 0.581
        ? "#ffffbf"
        : prop > 0.487
        ? "#c7e9ad"
        : prop > 0.368
        ? "#80bfac"
        : "#2b83ba"
    return color
  },
  getSewerColor(prop) {
    let color
    color =
      prop === "SEPARATE"
        ? "#7189bf"
        : prop === "COMBINED"
        ? "#df7599"
        : prop === "DIRECT DRAINAGE"
        ? "#ffc785"
        : "#72d6c9"
    return color
  },
  giClusterColors(cluster) {
    const childCount = cluster.getChildCount()
    let clusterClass = " gi-cluster-"
    if (childCount < 10) {
      clusterClass += "1"
    } else if (childCount < 50) {
      clusterClass += "2"
    } else if (childCount < 150) {
      clusterClass += "3"
    } else if (childCount < 450) {
      clusterClass += "4"
    } else {
      clusterClass += "5"
    }
    return new L.DivIcon({
      html: "<div><span>" + childCount + "</span></div>",
      className: "marker-cluster" + clusterClass,
      iconSize: new L.Point(40, 40)
    })
  },
  callClusterColors(cluster) {
    const childCount = cluster.getChildCount()
    let clusterClass = " call-cluster-"
    if (childCount < 20) {
      clusterClass += "1"
    } else if (childCount < 200) {
      clusterClass += "2"
    } else if (childCount < 400) {
      clusterClass += "3"
    } else if (childCount < 800) {
      clusterClass += "4"
    } else {
      clusterClass += "5"
    }
    return new L.DivIcon({
      html: "<div><span>" + childCount + "</span></div>",
      className: "marker-cluster" + clusterClass,
      iconSize: new L.Point(40, 40)
    })
  }
}

const accessToken =
  "pk.eyJ1IjoiYWx1MiIsImEiOiJja2x1bTB3a3Mwa2FnMnVwOXV4YmQ4Z2lmIn0.JQCTZKJ7h2arho-Xcv1Oug"

L.MakiMarkers.accessToken = accessToken
const tpIcon = new L.MakiMarkers.icon({
  icon: "water",
  color: "#15abc2",
  size: "s"
})
