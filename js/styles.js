const accessToken =
  "pk.eyJ1IjoiYWx1MiIsImEiOiJja2x1bTB3a3Mwa2FnMnVwOXV4YmQ4Z2lmIn0.JQCTZKJ7h2arho-Xcv1Oug"

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
    // color: "#61264f",
    // fillColor: "#ff40c6",
    color: "#53ad5c",
    fillColor: "#4aff5c",
    opacity: 0.6,
    fillOpacity: 0.6
  },
  highlight: {
    color: "#8cc3d1",
    fillColor: "#abeeff"
  },
  selectAndHighlight: {
    color: "#93b068",
    fillColor: "#d2ff8f"
  },
  csaChoro: feature => {
    return {
      fillColor: getChoroColorCSA(feature.properties.csa_pct),
      weight: 2,
      opacity: 0.6,
      color: "#454545",
      fillOpacity: 0.6
    }
  },
  impervChoro: feature => {
    return {
      fillColor: getChoroColorImperv(feature.properties.impervious_pct),
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
  sewersheds: feature => {
    return {
      weight: 2,
      opacity: 1,
      color: "white",
      fillOpacity: 0.7,
      fillColor:
        "#" + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6)
    }
  },
  sewerAreas: feature => {
    return {
      fillColor: getSewerColor(feature.properties.sewer_type),
      weight: 2,
      opacity: 0.7,
      color: "#454545",
      fillOpacity: 0.6
    }
  }
}

L.MakiMarkers.accessToken = accessToken
const tpIcon = L.MakiMarkers.icon({icon: "water", color: "#15abc2", size: "s"})