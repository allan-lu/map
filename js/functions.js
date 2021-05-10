const displayAttributes = property => {
  const boroughs = property.geoid.split(", ").map(getBorough)
  property.borough = [...new Set(boroughs)].join(", ")

  // Clear the attribute container before every click
  d3.select("#attr-list #attr-blank")
    .classed("d-none", true)
    .classed("d-block", false)
  $("#attr-list li").remove()
  // Using a for-in loop create html elements for each attribute
  for (const key in property) {
    const [attribute, value] = renameProperty(key, property[key])

    // Create the attribute list items with a heading and paragraph elements
    // Do not display unnecessary variables (_uid_ & gid)
    if (!["_uid_", "gid"].includes(key)) {
      // Create an id for each list item using the variable names
      const id = "attr-" + key.split("_").join("-")

      $("#attr-list").append(
        // Create list item element
        $("<li>")
          .attr("id", id)
          .addClass(["list-group-item", "p-0"])
          .css("border", "none")
          .append(
            // Create header element
            $("<h6>").addClass(["m-1", "font-weight-bold"]).text(attribute),
            // Create paragraph element
            $("<h6>").addClass(["mb-2 mr-0 pl-2"]).text(value)
          )
      )
    }
  }

  // Move the neighborhood and borough list item to the top of the list
  $("#attr-neighborhood").remove().insertBefore($("#attr-geoid"))
  $("#attr-borough").remove().insertBefore($("#attr-geoid"))
}

const onEachNTAFeature = (feature, layer) => {
  const prop = "neighborhood"
  // Add events to the polygons
  layer.on({
    mouseover: e => {
      highlightFeature(e)
      displayPopup(e, prop)
    },
    mouseout: e => {
      resetToDefault(e)
      removePopup(e)
    },
    mousemove: movePopup,
    click: selectFeature
  })
}

const displayPopup = (e, prop) => {
  const target = e.target
  const feature = target.feature
  const property =
    prop === "sewershed"
      ? getSewershed(feature.properties[prop])
      : prop === "neighborhood"
      ? feature.properties[prop].replaceAll("-", ",<br>")
      : prop === "treatment_plant"
      ? capitalize(feature.properties[prop])
      : prop === "sewer_type"
      ? capitalize(getSewerType(feature.properties[prop]))
      : feature.properties[prop]

  const attribute =
    prop === "neighborhood" ? "Neighborhood(s)" : capitalize(prop)
  const popupContent = `<h6><strong>${attribute}:</strong><br>${property}</h6>`
  target
    .bindPopup(popupContent, {
      // maxWidth: 160,
      autoPan: false,
      closeButton: false,
      interactive: false,
      className: "popup-custom"
    })
    .openPopup(e.latlng)
}

const removePopup = e => {
  const target = e.target
  target.closePopup()
}

const movePopup = e => {
  const target = e.target
  target.openPopup(e.latlng)
}

const highlightFeature = e => {
  const target = e.target
  const gid = target.feature.properties.gid
  if (checkSelected(gid)) {
    // Highlight bar in bar chart
    highlightSelected(null, target.feature.properties)
  } else {
    target.setStyle(myStyle.highlight)
  }
}

const resetToDefault = e => {
  const target = e.target
  const gid = target.feature.properties.gid
  const styleDefault = target.defaultOptions.style(target.feature)

  if (checkSelected(gid)) {
    // Reset bar chart highlight
    unhighlightSelected(null, target.feature.properties)
  } else {
    target.setStyle(styleDefault)
  }
}

const selectFeature = e => {
  const target = e.target
  const properties = target.feature.properties
  const gid = target.feature.properties.gid
  const bounds = target.getBounds()
  const padding = [90, 90]

  selectAndZoom(properties, gid, bounds, padding)
}

const selectAndZoom = (props, gid, bounds, pad) => {
  if (gidArray.includes(gid)) {
    // Selecting an already selected feature will unselect it on both the map
    // and the neighborhood list panel
    unselectNTA(gid)
  } else {
    clearNTAs()

    // Select feature in both the left panel and map
    selectNTA(gid)

    // Display neighborhood attributes in right panel
    displayAttributes(props)

    // Zoom to selected feature
    zoomToSelection(bounds, pad)
  }

  // Clear polygon selector layer
  drawnItems.clearLayers()
  // Remove charts from empty container and display text
  d3.select("#charts-container #charts-blank").classed("d-block", true)
}

const zoomToSelection = (bounds, pad = [0, 0]) => {
  // If sidebar is open pan map over
  if (!$("#sidebar").hasClass("collapsed")) {
    const zoom = myMap.getBoundsZoom(bounds, false, pad)
    const sidebarWidth = $(".leaflet-sidebar-pane").width() - 36
    let center = L.CRS.Simple.latLngToPoint(bounds.getCenter(), zoom)
    center.x += sidebarWidth
    center = L.CRS.Simple.pointToLatLng(center, zoom)
    myMap.setView(center, zoom)
  } else {
    myMap.fitBounds(bounds, { padding: pad })
  }
}

const checkSelected = feature => {
  return gidArray.includes(feature)
}

const selectNTA = gid => {
  // // Highlight and scroll to selected neighborhood on the left side
  $(`#${gid}`).css("background-color", "rgba(126, 186, 73, 0.3)")
  document.getElementById(`${gid}`).scrollIntoView({ block: "center" })

  ntaLayerGroup.eachLayer(layer => {
    layer.eachLayer(i => {
      if (i.feature.properties.gid === gid) {
        // Keep track of selected features
        selectedLayerGroup.addLayer(i.setStyle(myStyle.selected))
      }
    })
  })

  // Keep track of selected features
  gidArray.push(gid)
}

const unselectNTA = gid => {
  clearNTAs()

  // // Set zoom level to default
  zoomToSelection(defaultBounds)

  // Remove the layers from the selected layer group and reset their style
  ntaLayerGroup.eachLayer(layer => {
    layer.eachLayer(i => {
      if (i.feature.properties.gid === gid) {
        selectedLayerGroup.removeLayer(i)
      }
    })
  })
}

const clearNTAs = () => {
  // Unselect element from left panel and clear attribute container
  $(".list-group-item").css("background-color", "")
  $("#attr-list li").remove()
  d3.select("#attr-list #attr-blank").classed("d-block", true)

  // Clear selected layers
  selectedLayerGroup.clearLayers()
  gidArray.length = 0

  // Reset all layer styles
  ntaLayerGroup.eachLayer(layer => {
    layer.resetStyle()
  })

  d3.select("#charts-container").selectAll("svg, h5").remove()
}

const onEachSewershed = (feature, layer) => {
  const prop = "sewershed"
  layer.on({
    mouseover: e => {
      displayPopup(e, prop)
    },
    mouseout: e => {
      removePopup(e)
    },
    mousemove: movePopup
  })
}

const onEachTP = (feature, layer) => {
  const prop = "treatment_plant"
  layer.on({
    mouseover: e => {
      displayPopup(e, prop)
    },
    mouseout: e => {
      removePopup(e)
    },
    mousemove: movePopup
  })
}

const onEachSewerArea = (feature, layer) => {
  const prop = "sewer_type"
  layer.on({
    mouseover: e => {
      displayPopup(e, prop)
    },
    mouseout: e => {
      removePopup(e)
    },
    mousemove: movePopup
  })
}

const getChoroColorCSA = prop => {
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
}

const getChoroColorImperv = prop => {
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
}

const getSewerColor = prop => {
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
}

// Function to capitalize the first letter of each word in a string
const capitalize = s => {
  s = s.toLowerCase()
  return s
    .split(/[\s_]+/)
    .map(w => w.charAt(0).toUpperCase() + w.substring(1))
    .join(" ")
}

const renameProperty = (prop, value) => {
  let area1, area2
  // Rename the variable names to provide clearer information
  switch (prop) {
    case "geoid":
      attribute = "Neighorhood Tabulation Area (NTA) Code(s)"
      break
    case "neighborhood":
      attribute = "Neighborhood(s)"
      // value = value.replaceAll("-", ", ")
      value = value
        .split(/-|,\s*/)
        .sort()
        .join(", ")
      break
    case "population":
      attribute = capitalize(prop)
      value = value.toLocaleString("en")
      break
    case "gi_count":
      attribute = "Number of Green Infrastructures"
      break
    case "gi_area":
      attribute = "Combined Green Infrastructure Area"
      value = value.toLocaleString("en")
      break
    case "pervious_pct":
      attribute = "Percent Area of Pervious Land"
      value = (value * 100.0).toFixed(2) + "%"
      break
    case "impervious_pct":
      attribute = "Percent Area of Impervious Land"
      value = (value * 100.0).toFixed(2) + "%"
      break
    case "sewer_311_calls":
      attribute = "311 Calls in 2019 Related to Sewer/Sewage Incidents"
      break
    case "csa_pct":
      attribute = "Percent Area With a Combined Sewer System"
      value = (value * 100.0).toFixed(2) + "%"
      break
    case "sewershed":
      attribute = "Major Sewershed(s)"
      sewershed = value.split(", ").map(getSewershed).join(", ")
      value = sewershed + ` (${value})`
      break
    case "area":
      attribute = "NTA Area"
      area1 = Math.round(value).toLocaleString("en")
      area2 = (value / 43560.0).toFixed(2).toLocaleString("en")
      value = `${area1} sqft || ${area2} acres`
      break
    case "borough":
      attribute = "Borough(s)"
      break
    default:
      attribute = capitalize(prop)
  }
  return [attribute, value]
}

const getBorough = ntaCode => {
  switch (ntaCode.substring(0, 2)) {
    case "BK":
      return "Brooklyn"
    case "BX":
      return "Bronx"
    case "MN":
      return "Manhattan"
    case "QN":
      return "Queens"
    case "SI":
      return "Staten Island"
    default:
      return ""
  }
}

const getSewershed = accr => {
  switch (accr) {
    case "26W":
      return "26th Ward"
    case "BB":
      return "Bowery Bay"
    case "CI":
      return "Coney Island"
    case "HP":
      return "Hunts Point"
    case "JAM":
      return "Jamaica"
    case "NC":
      return "Newtown Creek"
    case "NR":
      return "North River"
    case "OB":
      return "Oakwood Beach"
    case "OH":
      return "Owls Head"
    case "PR":
      return "Port Richmond"
    case "RH":
      return "Red Hook"
    case "ROC":
      return "Rockaway"
    case "TI":
      return "Tallman Island"
    case "WI":
      return "Wards Island"
    default:
      return ""
  }
}

const getSewerType = sewer => {
  if (sewer === "OTHER" || sewer === "UNKNOWN" || sewer === null) {
    return "Other / Unknown"
  } else {
    return sewer
  }
}

const concatGeoJSON = (g1, g2) => {
  return {
    type: "FeatureCollection",
    features: [...g1.features, ...g2.features]
  }
}

const getSelection = (drawnLayer, selectLayer) => {
  let drawnGJSON = drawnLayer.toGeoJSON()

  // Drawn circles are point geometries, convert to polygons
  if (turf.getType(drawnGJSON) === "Point") {
    const radius = drawnLayer._mRadius / 1000
    const center = drawnGJSON.geometry.coordinates
    drawnGJSON = turf.circle(center, radius, { units: "kilometers" })
  }

  // Select all the polygons fully within the drawn shape
  selectLayer.eachLayer(layer => {
    // MultiPolygons need to be converted to a FeatureCollection
    layer = turf.flatten(layer.toGeoJSON())
    const features = layer.features
    const len = features.length
    let counter = 0
    for (let i = 0; i < len; i++) {
      if (turf.booleanWithin(features[i], drawnGJSON)) {
        counter++
      }
    }
    // Only select the feature if all polygons of a MultiPolygon are within selected area
    if (counter === len) {
      const gid = features[0].properties.gid
      selectNTA(gid)
    }
  })

  // Zoom to all selected polygons
  if (selectedLayerGroup.getLayers().length) {
    zoomToSelection(selectedLayerGroup.getBounds(), [90, 90])
  }

  return gidArray
}

const selectMultiple = layer => {
  drawnItems.clearLayers()
  clearNTAs()

  drawnItems.addLayer(layer)
  return getSelection(layer, ntaCSA)
}

// Create an array of property objects for all the selected polygons
// Argument: array of gid
const createAttrObj = arr => {
  // Each value is an array of attributes
  const objArr = []
  arr.forEach(gid => {
    ntaCSA.eachLayer(layer => {
      const properties = layer.feature.properties
      if (properties.gid === gid) {
        objArr.push(properties)
      }
    })
  })
  return objArr
}

// Combine the attribute arrays in the object
const combineProperties = arr => {
  // Create a single object where each value is an array
  const attrObj = {}
  for (const properties of arr) {
    for (attr in properties) {
      for (attr in properties) {
        const value = properties[attr]
        // Add attribute value to array
        attrObj.hasOwnProperty(attr)
          ? attrObj[attr].push(value)
          : (attrObj[attr] = new Array())
      }
    }
  }

  for (attr in attrObj) {
    let value = attrObj[attr]
    // For percentages, multiply the values by the NTA area and then combine
    if (attr.includes("pct")) {
      attrObj[attr] =
        value
          .map((e, i) => {
            return e * attrObj.area[i]
          })
          .reduce((acc, e) => acc + e, 0) /
        attrObj.area.reduce((acc, e) => acc + e, 0)
    } else if (typeof value[0] === "string") {
      // Alphabetize and remove duplicate values
      attrObj[attr] = [...new Set(value.sort())].join(", ")
    } else {
      // Sum remaining values
      attrObj[attr] = value.reduce((acc, e) => acc + e, 0)
    }
  }
  displayAttributes(attrObj)
}

const createChart = (attrObj, property) => {
  const data = attrObj.sort((a, b) => (a.geoid > b.geoid ? 1 : -1))
  const dataFormat = property.includes("pct") ? ".1%" : ",.2r"

  d3.select("#charts-container #charts-blank")
    .classed("d-none", true)
    .classed("d-block", false)

  d3.select("#charts-container").select(`#${property}-title`).remove()
  d3.select("#charts-container").select(`#${property}`).remove()

  const title = renameProperty(property, data[0][property])[0]
  $("#charts-container").append(
    $("<h5>")
      .attr("id", `${property}-title`)
      .addClass(["text-wrap", "font-weight-bold", "text-center", "p-0", "m-0"])
      .text(title)
  )

  const margin = { top: 0, right: 13, bottom: 30, left: 40 }
  const barHeight = 15
  const height =
    Math.ceil((data.length + 0.1) * barHeight) + margin.top + margin.bottom
  const width = $(".leaflet-sidebar-pane").width()
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, d => d[property])])
    .range([margin.left, width - margin.right])
  const y = d3
    .scaleBand()
    .domain(d3.range(data.length))
    .rangeRound([margin.top, height - margin.bottom])
    .padding(0.1)
  const format = d3.format(dataFormat)
  const xAxis = g =>
    g
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .classed("x-axis", true)
      .call(
        d3
          .axisBottom(x)
          .ticks(width / 80, dataFormat.includes("%") ? ".0%" : dataFormat)
      )
  const yAxis = g =>
    g
      .attr("transform", `translate(${margin.left}, 0)`)
      .classed("y-axis", true)
      .call(
        d3
          .axisLeft(y)
          .tickFormat(i => data[i].geoid)
          .tickSizeOuter(0)
      )

  const svg = d3
    .select("#charts-container")
    .append("svg")
    .attr("id", property)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("viewBox", [0, 0, width, height])

  const bar = svg
    .append("g")
    .classed("svg-bars", true)
    .attr("fill", "#5175b0")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("geoid", d => d.geoid)
    .on("mouseover", highlightSelected)
    .on("mouseout", unhighlightSelected)
    .attr("x", x(0))
    .attr("y", (d, i) => y(i))
    .attr("width", d => x(d[property]) - x(0))
    .attr("height", y.bandwidth())
    .append("svg:title")
    .text(d => d.neighborhood)

  svg
    .append("g")
    .classed("svg-bar-text", true)
    .attr("fill", "white")
    .attr("text-anchor", "end")
    .attr("font-family", "sans-serif")
    .attr("font-size", 10)
    .selectAll("text")
    .data(data)
    .join("text")
    .on("mouseover", highlightSelected)
    .on("mouseout", unhighlightSelected)
    .attr("geoid", d => d.geoid)
    .attr("x", d => x(d[property]))
    .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("dx", -4)
    .text(d => format(d[property]))
    .call(text =>
      text
        .filter(d => x(d[property]) - x(0) < 50) // short bars
        .attr("dx", +4)
        .attr("fill", "black")
        .attr("text-anchor", "start")
    )
    .append("svg:title")
    .text(d => d.neighborhood)

  svg.append("g").call(xAxis)
  svg.append("g").call(yAxis)

  svg
    .selectAll(".y-axis .tick")
    .data(data)
    .on("mouseover", highlightSelected)
    .on("mouseout", unhighlightSelected)
    .attr("geoid", d => d.geoid)
    .append("svg:title")
    .text(d => d.neighborhood)

  return svg
}

const highlightSelected = (e, d) => {
  d3.selectAll(".svg-bars")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("fill", "#508a62")

  d3.selectAll(".tick")
    .select("text")
    .filter(function () {
      return d3.select(this).text() === d.geoid
    })
    .attr("fill", "#7eba49")

  selectedLayerGroup.eachLayer(layer => {
    if (myMap.hasLayer(layer) && layer.feature.properties.geoid === d.geoid) {
      layer.setStyle(myStyle.selectAndHighlight)
    }
  })
}

const unhighlightSelected = (e, d) => {
  d3.selectAll(".svg-bars")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("fill", "#5175b0")

  d3.selectAll(".tick")
    .select("text")
    .filter(function () {
      return d3.select(this).text() === d.geoid
    })
    .attr("fill", "black")

  selectedLayerGroup.setStyle(myStyle.selected)
}
