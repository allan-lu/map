// Add NTA attributes to a div in the sidebar
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
    if (
      ![
        "_uid_",
        "gid",
        "gi_incon",
        "gi_plan",
        "gi_count",
        "calls_311_flood",
        "calls_311_odor"
      ].includes(key)
    ) {
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
            $("<h6>").addClass(["mb-2 mr-0 pl-2 attr-value"]).text(value)
          )
      )
    }
  }

  // Move the neighborhood and borough list item to the top of the list
  $("#attr-neighborhood").remove().insertBefore($("#attr-geoid"))
  $("#attr-borough").remove().insertBefore($("#attr-geoid"))
}

// Add events to each NTA polygon
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
    click: e => {
      const target = e.target
      const properties = target.feature.properties
      const gid = target.feature.properties.gid
      const bounds = target.getBounds()
      const padding = [90, 90]

      selectAndZoom(properties, gid, bounds, padding)
    }
  })
}

// Add popups that show name of the polygon
const displayPopup = (e, prop) => {
  const target = e.target
  const feature = target.feature
  const property =
    prop === "sewershed"
      ? getSewershed(feature.properties[prop])
      : prop === "neighborhood"
      ? feature.properties[prop].split(/-(?![a-z])|,\s*/).sort().join(",<br>")
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

// Track popup with the location of cursor
const movePopup = e => {
  const target = e.target
  target.openPopup(e.latlng)
}

// Highlight the NTA polygon
const highlightFeature = e => {
  const target = e.target
  const gid = target.feature.properties.gid

  if (gidArray.includes(gid)) {
    // Highlight bar in bar chart
    highlightSelected(null, target.feature.properties)
  } else {
    target.setStyle(myStyle.highlight)
  }
}

// Reset the highlighted polygon to previous style
const resetToDefault = e => {
  const target = e.target
  const gid = target.feature.properties.gid
  const geoid = target.feature.properties.geoid
  const stylePrev = target.defaultOptions.style(target.feature)

  // When multiple polygons are selected, prevent the polygon that was
  // both highlighted and selected from resetting when hovered over
  if (geoidArray.map(d => d.geoid).includes(geoid)) {
    return
  }
  if (gidArray.includes(gid)) {
    // Reset bar chart highlight
    unhighlightSelected(null, target.feature.properties)
  } else {
    target.setStyle(stylePrev)
  }
}

// Select and zoom to polygon(s)
const selectAndZoom = (props, gid, bounds, pad) => {
  // If multiple polygons are selected, selecting one within them
  // will highlight information about that NTA across all elements
  if (gidArray.length > 1 && gidArray.includes(gid)) {
    leaveHighlight(null, props)
  } else if (gidArray.includes(gid)) {
    // Selecting an already selected feature will unselect it on both the map
    // and the neighborhood list panel
    clearNTAs()

    // // Set zoom level to default
    zoomToBounds(defaultBounds)

    // Remove the layers from the selected layer group
    ntaLayerGroup.eachLayer(layer => {
      layer.eachLayer(i => {
        if (i.feature.properties.gid === gid) {
          selectedLayerGroup.removeLayer(i)
        }
      })
    })
  } else {
    clearNTAs()

    // Select feature in both the left panel and map
    selectNTA(gid)

    // Display neighborhood attributes in right panel
    displayAttributes(props)

    // Zoom to selected feature
    zoomToBounds(bounds, pad)

    // Create a pie chart comparing pervious to impervious land area
    createPies([props])
  }

  // Change CSS of Leaflet Draw delete button to "enabled"
  $(".leaflet-draw-edit-remove")
    .removeClass("leaflet-disabled")
    .prop("title", "Delete selection")
}

// Zoom to given bounds
const zoomToBounds = (bounds, pad = [0, 0]) => {
  // If sidebar is open pan map over
  if (!$("#sidebar").hasClass("collapsed")) {
    const zoom = Math.min(
      18,
      Math.max(11, myMap.getBoundsZoom(bounds, false, pad))
    )
    const sidebarWidth = $(".leaflet-sidebar-pane").width() - 36
    let center = L.CRS.Simple.latLngToPoint(bounds.getCenter(), zoom)
    center.x += sidebarWidth
    center = L.CRS.Simple.pointToLatLng(center, zoom)
    myMap.setView(center, zoom)
  } else {
    myMap.fitBounds(bounds, { padding: pad })
  }
}

// Actions performed when an NTA is selected
const selectNTA = gid => {
  // Highlight and scroll to selected neighborhood on the left side
  highlightLeftPanel(gid, "rgba(126, 186, 73, 0.3)")

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

// Highlight and scroll to selected neighborhood on the left side
const highlightLeftPanel = (gid, color) => {
  $(`#${gid}`).css("background-color", color)
  document.getElementById(`${gid}`).scrollIntoView({ block: "center" })
}

// Clearing visual properties and removing selected NTAs from layer group and array
const clearNTAs = () => {
  // Unselect element from left panel and clear attribute container
  $(".list-group-item").css("background-color", "")
  $("#attr-list li").remove()
  d3.select("#attr-list #attr-blank").classed("d-block", true)

  // Clear selected layers
  selectedLayerGroup.clearLayers()
  gidArray.length = 0
  geoidArray.length = 0

  // Reset all layer styles
  ntaLayerGroup.eachLayer(layer => {
    layer.resetStyle()
  })

  // Clear polygon selector layer
  drawnItems.clearLayers()

  // Remove charts from empty container and display text
  d3.selectAll("#charts-blank, #pie-blank").classed("d-block", true)
  d3.selectAll("#charts-container, #pie-container")
    .selectAll("svg, h5, p")
    .remove()

  // Change CSS of Leaflet Draw delete button to "disabled"
  $(".leaflet-draw-edit-remove")
    .addClass("leaflet-disabled")
    .prop("title", "No selections to delete")
}

// Events applied to each sewershed
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

// Events applied to each treatment plant
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

// Events applied to each sewer type area
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

// Function to capitalize the first letter of each word in a string
const capitalize = s => {
  s = s.toLowerCase()
  return s
    .split(/[\s_]+/)
    .map(w => w.charAt(0).toUpperCase() + w.substring(1))
    .join(" ")
}

// Renaming the NTA property key names to be more descriptive
// Convert the values to more be more presentable
const renameProperty = (prop, value) => {
  let area1, area2
  // Rename the variable names to provide clearer information
  switch (prop) {
    case "geoid":
      attribute = "Neighorhood Tabulation Area (NTA) Code(s)"
      break
    case "neighborhood":
      attribute = "Neighborhood(s)"
      value = value
        .split(/-(?![a-z])|,\s*/)
        .sort()
        .join(", ")
      break
    case "population":
      attribute = capitalize(prop)
      value = value.toLocaleString("en")
      break
    case "gi_con":
      attribute = "Number of Constructed Green Infrastructures"
      value = value.toLocaleString("en")
      break
    case "gi_count":
      attribute = "Number of Green Infrastructures By Status"
      value = value.toLocaleString("en")
      break
    case "gi_area":
      attribute = "Combined Green Infrastructure Area"
      area1 = Math.round(value).toLocaleString("en")
      area2 = (value / 43560.0).toLocaleString("en", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
      value = `${area1} sqft || ${area2} acres`
      break
    case "pervious_pct":
      attribute = "Percent Area of Pervious Land"
      value = (value * 100.0).toFixed(2) + "%"
      break
    case "impervious_pct":
      attribute = "Percent Area of Impervious Land"
      value = (value * 100.0).toFixed(2) + "%"
      break
    case "calls_311":
      attribute = `311 Calls in ${year - 1} Related to Sewer/Sewage Incidents`
      value = value.toLocaleString("en")
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
      area2 = (value / 43560.0).toLocaleString("en", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
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

// Get borough from NTA code
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

// Get sewershed name from abbreviation
const getSewershed = abbr => {
  switch (abbr) {
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

// Get sewer type
const getSewerType = sewer => {
  if (sewer === "OTHER" || sewer === "UNKNOWN" || sewer === null) {
    return "Other / Unknown"
  } else {
    return sewer
  }
}

const getCategory = status => {
  switch (status) {
    case "gi_con":
      return "Constructed"
    case "gi_incon":
      return "In Construction"
    case "gi_plan":
      return "Designed"
    case "calls_311_flood":
      return "Clogged/Flooding"
    case "calls_311_odor":
      return "Sewer Odor"
    default:
      return status
  }
}

// When a selector polygon is drawn, call the following functions
const selectMultiple = layer => {
  // Find which polygons were selected
  const selectedFeatures = findWithin(layer)

  // If no polygons selected end drawing
  if (selectedFeatures.length === 0) return

  // Create an attribute object of the selected polygons
  const selectedAttr = createAttrObj(selectedFeatures)
  // In the attributes sidebar tab, combine all the properties of the selected polygons
  combineProperties(selectedAttr)

  // Draw the bar & pie charts
  createStackedBar(selectedAttr, ["gi_con", "gi_incon", "gi_plan"], "gi_count")
  createStackedBar(
    selectedAttr,
    ["calls_311_flood", "calls_311_odor"],
    "calls_311"
  )
  createChart(selectedAttr, "population")
  createPies(selectedAttr)
}

// Find which polygons were selected using Turf.js's booleanWithin function
// Returns an array of the selected polygon's gid's
const findWithin = layer => {
  let drawnGJSON = layer.toGeoJSON()

  // Delete previous selector and selected polygons
  clearNTAs()
  // Display selector polygon
  drawnItems.addLayer(layer)

  // Drawn circles are point geometries, convert to polygons
  if (turf.getType(drawnGJSON) === "Point") {
    const radius = layer._mRadius / 1000
    const center = drawnGJSON.geometry.coordinates
    drawnGJSON = turf.circle(center, radius, { units: "kilometers" })
  }

  // Select all the polygons fully within the drawn shape
  ntaCSA.eachLayer(polygon => {
    // MultiPolygons need to be converted to a FeatureCollection
    polygon = turf.flatten(polygon.toGeoJSON())
    const features = polygon.features
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
    zoomToBounds(selectedLayerGroup.getBounds(), [90, 90])
  }

  return gidArray
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

const createStackedBar = (attrObj, properties, total) => {
  // Sort the data by NTA code
  const data = attrObj.slice().sort((a, b) => d3.ascending(a[total], b[total]))
  // Stack the data by the desired columns
  const stack = d3.stack().keys(properties)
  const series = stack(data).map(d => (d.forEach(v => (v.key = d.key)), d))

  const margin = { top: 0, right: 25, bottom: 30, left: 40 }
  const barHeight = 15
  const height =
    Math.ceil((data.length + 0.1) * barHeight) + margin.top + margin.bottom
  const width =
    $(window).width() > 768
      ? $(".leaflet-sidebar-pane").width()
      : $(window).width() - 40
  const x = d3
    .scaleLinear()
    .domain([0, d3.max(series, d => d3.max(d, d => d[1]))])
    .range([margin.left, width - margin.right])
  const y = d3
    .scaleBand()
    .domain(data.map(d => d.geoid))
    .range([margin.top, height - margin.bottom])
    .padding(0.1)
  const color = d3
    .scaleOrdinal()
    .domain(series.map(d => d.key))
    .range(
      properties.length == 3
        ? ["#143d59", "#ffd55a", "#6dd47e"]
        : ["#efc9af", "#1f8ac0"]
    )
  const xAxis = g =>
    g
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .classed("x-axis", true)
      .call(d3.axisBottom(x).ticks(width / 80, ",~r"))
  const yAxis = g =>
    g
      .attr("transform", `translate(${margin.left}, 0)`)
      .classed("y-axis", true)
      .call(d3.axisLeft(y).tickSizeOuter(0))
      .call(g => g.selectAll(".domain"))
  const format = d3.format(",~r")

  // Hide the text that's displayed when no polygons are selected
  d3.select("#charts-container #charts-blank")
    .classed("d-none", true)
    .classed("d-block", false)

  // Add a title to the chart
  const title = renameProperty(total, data[0][total])[0]
  $("#charts-container").append(
    $("<h5>")
      .attr("id", `${total.replace(/_/, "-")}-title`)
      .addClass(["text-wrap", "font-weight-bold", "text-center", "p-0", "m-0"])
      .text(title)
  )

  // Add legend
  const legendHeight = 15
  let dataL = 0
  const offset = (width - margin.left - margin.right) / properties.length
  const legend = d3
    .select("#charts-container")
    .append("svg")
    .classed("bar-legend", true)
    .attr("preserveAspectRatio", "xMaxYMax meet")
    .attr("viewBox", [0, 0, width, legendHeight])
    .selectAll("g")
    .append("g")
    .data(properties)
    .enter()
    .append("g")
    .attr("transform", (d, i) => {
      const newdataL = dataL
      dataL += d.length + offset
      return `translate(${newdataL}, 0)`
    })
  // Legend symbols
  legend
    .append("rect")
    .attr("x", margin.left + 5)
    .attr("y", 0)
    .attr("width", 10)
    .attr("height", 10)
    .attr("fill", (d, i) => color(i))
  // Legend text
  legend
    .append("text")
    .attr("font-family", "sans-serif")
    .attr("font-size", "0.9em")
    .attr("x", margin.left + 18)
    .attr("y", 10)
    .text(d => getCategory(d))
    .attr("text-anchor", "start")

  // Add bar chart
  const svg = d3
    .select("#charts-container")
    .append("svg")
    .attr("id", `${total.replace(/_/, "-")}-chart`)
    .attr("preserveAspectRatio", "xMidYMax meet")
    .attr("viewBox", [0, 0, width, height])

  // Add the bars
  svg
    .append("g")
    .selectAll("g")
    .data(series)
    .join("g")
    .classed("svg-stack-bar", true)
    .attr("fill", d => color(d.key))
    .selectAll("rect")
    .data(d => d)
    .join("rect")
    .attr("geoid", d => d.data.geoid)
    .on("mouseover", (e, d) => highlightSelected(e, d.data))
    .on("mouseout", (e, d) => {
      if (!geoidArray.map(d => d.geoid).includes(d.data.geoid))
        unhighlightSelected(e, d.data)
    })
    .on("click", (e, d) => leaveHighlight(e, d.data))
    .attr("x", d => x(d[0]))
    .attr("y", d => y(d.data.geoid))
    .attr("width", d => x(d[1]) - x(d[0]))
    .attr("height", y.bandwidth())
    .append("svg:title")
    .text(
      d => `${d.data.neighborhood}\n${getCategory(d.key)}: ${d.data[d.key]}`
    )

  // Add text to each bar
  const xLabel = d3
    .scaleLinear()
    .domain([0, d3.max(data, d => d[total])])
    .range([margin.left, width - margin.right])
  const yLabel = d3
    .scaleBand()
    .domain(d3.range(data.length))
    .rangeRound([margin.top, height - margin.bottom])
    .padding(0.1)
  svg
    .append("g")
    .classed("svg-bar-text", true)
    .attr("text-anchor", "end")
    .attr("font-family", "sans-serif")
    .attr("font-size", 10)
    .selectAll("text")
    .data(data)
    .join("text")
    .on("mouseover", highlightSelected)
    .on("mouseout", (e, d) => {
      if (!geoidArray.map(d => d.geoid).includes(d.geoid))
        unhighlightSelected(e, d)
    })
    .on("click", leaveHighlight)
    .attr("geoid", d => d.geoid)
    .attr("x", d => xLabel(d[total]))
    .attr("y", (d, i) => yLabel(i) + yLabel.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("dx", +4)
    .attr("text-anchor", "start")
    .text(d => format(d[total]))
    .append("svg:title")
    .text(d => d.neighborhood)

  // Add axis labels
  svg.append("g").call(xAxis)
  svg.append("g").call(yAxis)

  // Add mouse events to the y-axis's labels
  svg
    .selectAll(".y-axis .tick")
    .data(data)
    .on("mouseover", highlightSelected)
    .on("mouseout", (e, d) => {
      if (!geoidArray.map(d => d.geoid).includes(d.geoid))
        unhighlightSelected(e, d)
    })
    .on("click", leaveHighlight)
    .attr("geoid", d => d.geoid)
    .append("svg:title")
    .text(d => d.neighborhood)
}

// Create a horizontal bar chart by desired NTA property
const createChart = (attrObj, property) => {
  // Sort the data by NTA code
  const data = attrObj
    .slice()
    .sort((a, b) => d3.ascending(a[property], b[property]))
  // Percentage properties are converted from decimals to percents
  const dataFormat = property.includes("pct") ? ".1%" : ",~r"

  // Hide the text that's displayed when no polygons are selected
  d3.select("#charts-container #charts-blank")
    .classed("d-none", true)
    .classed("d-block", false)

  // Add a title to the chart
  const title = renameProperty(property, data[0][property])[0]
  $("#charts-container").append(
    $("<h5>")
      .attr("id", `${property.replace(/_/, "-")}-title`)
      .addClass(["text-wrap", "font-weight-bold", "text-center", "p-0", "m-0"])
      .text(title)
  )

  // Define chart properties
  const margin = { top: 0, right: 13, bottom: 30, left: 40 }
  const barHeight = 15
  const height =
    Math.ceil((data.length + 0.1) * barHeight) + margin.top + margin.bottom
  const width =
    $(window).width() > 768
      ? $(".leaflet-sidebar-pane").width()
      : $(window).width() - 40
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

  // Create the svg element that other html elements will fit in
  const svg = d3
    .select("#charts-container")
    .append("svg")
    .attr("id", `${property.replace(/_/, "-")}-chart`)
    .attr("preserveAspectRatio", "xMidYMax meet")
    .attr("viewBox", [0, 0, width, height])

  // Add the bars
  svg
    .append("g")
    .classed("svg-bar", true)
    .attr("fill", "#5175b0")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("geoid", d => d.geoid)
    .on("mouseover", highlightSelected)
    .on("mouseout", (e, d) => {
      if (!geoidArray.map(d => d.geoid).includes(d.geoid))
        unhighlightSelected(e, d)
    })
    .on("click", leaveHighlight)
    .attr("x", x(0))
    .attr("y", (d, i) => y(i))
    .attr("width", d => x(d[property]) - x(0))
    .attr("height", y.bandwidth())
    .append("svg:title")
    .text(d => d.neighborhood)

  // Add text to each bar
  svg
    .append("g")
    .attr("fill", "white")
    .attr("text-anchor", "end")
    .attr("font-family", "sans-serif")
    .attr("font-size", 10)
    .selectAll("text")
    .data(data)
    .join("text")
    .on("mouseover", highlightSelected)
    .on("mouseout", (e, d) => {
      if (!geoidArray.map(d => d.geoid).includes(d.geoid))
        unhighlightSelected(e, d)
    })
    .on("click", leaveHighlight)
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

  // Add the axes and axis labels
  svg.append("g").call(xAxis)
  svg.append("g").call(yAxis)

  // Add mouse events to the y-axis's labels
  svg
    .selectAll(".y-axis .tick")
    .data(data)
    .on("mouseover", highlightSelected)
    .on("mouseout", (e, d) => {
      if (!geoidArray.map(d => d.geoid).includes(d.geoid))
        unhighlightSelected(e, d)
    })
    .on("click", leaveHighlight)
    .attr("geoid", d => d.geoid)
    .append("svg:title")
    .text(d => d.neighborhood)
}

// Highlight polygons and bar chart bars on event
const highlightSelected = (e, d) => {
  // Highlight bar chart bars and tick labels
  d3.selectAll(".svg-stack-bar")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("opacity", 0.5)
  d3.selectAll(".svg-bar")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("fill", "#3e824f")
  d3.selectAll(".svg-bar-text")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("fill", "#7eba49")
  d3.selectAll(".tick")
    .select("text")
    .filter(function () {
      return d3.select(this).text() === d.geoid
    })
    .attr("fill", "#7eba49")

  // Highlight pie chart arcs
  d3.selectAll(".svg-arcs")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("stroke", "black")
    .attr("stroke-width", 2)

  // Highlight NTA polygons
  selectedLayerGroup.eachLayer(layer => {
    if (layer.feature.properties.geoid === d.geoid) {
      layer.setStyle(myStyle.selectAndHighlight)
    }
  })
}

// Unhighlight polygons and bar chart bars on event
const unhighlightSelected = (e, d) => {
  // Bar chart elements
  d3.selectAll(".svg-stack-bar")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("opacity", 1)
  d3.selectAll(".svg-bar")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("fill", "#5175b0")
  d3.selectAll(".svg-bar-text")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("fill", "black")
  d3.selectAll(".tick")
    .select("text")
    .filter(function () {
      return d3.select(this).text() === d.geoid
    })
    .attr("fill", "black")

  // Pie chart arcs
  d3.selectAll(".svg-arcs")
    .selectAll(`[geoid=${d.geoid}]`)
    .attr("stroke", "white")

  // Polygon features
  selectedLayerGroup.eachLayer(layer => {
    if (layer.feature.properties.geoid === d.geoid) {
      layer.setStyle(myStyle.selected)
    }
  })
}

// Makes the highlighted bar, sector and polygon stay highlighted
const leaveHighlight = (e, d) => {
  // Clear all the previously selected elements
  geoidArray.forEach(e => {
    unhighlightSelected(null, e)
    highlightLeftPanel(e.gid, "rgba(126, 186, 73, 0.3)")
  })
  geoidArray.length = 0
  $("#attr-list li .attr-value span").remove()

  // Highlight selected element across all charts, maps and panels
  highlightSelected(e, d)

  // Append selected NTA properties to the attributes tab in the sidebar
  $("#attr-list li").each((i, e) => {
    const propName = $(e).attr("id").split(/-(.+)/)[1].replaceAll("-", "_")
    d.borough = getBorough(d.geoid)
    const [attribute, value] =
      propName !== "sewershed"
        ? renameProperty(propName, d[propName])
        : [null, d[propName]]

    $(e)
      .find(".attr-value")
      .append(
        $("<span>")
          .addClass(["font-weight-bold", "text-success"])
          .text(` [${value}]`)
      )
  })

  // Scroll to and highlight the neighborhood name on the left panel
  highlightLeftPanel(d.gid, "rgba(230, 255, 89, 0.3)")

  // Keep track of the selected NTA
  geoidArray.push({ geoid: d.geoid, gid: d.gid })
}

// Create pie chart
const createPies = attrArray => {
  // Sort the data by NTA code
  const data = attrArray.sort((a, b) => (a.geoid > b.geoid ? 1 : -1))
  // Chart title
  let title = `Pervious vs Impervious Land Area for ${attrArray[0].neighborhood
    .split(/-|,\s*/)
    .sort()
    .join(", ")
    .replace(/, ([^,]*)$/, " & $1")}`

  // Variables that determine chart area
  const margin = 10
  const height = (width =
    $(window).width() > 768
      ? $(".leaflet-sidebar-pane").width()
      : $(window).width() - 40)
  const radius = Math.min(width - margin * 2, height - margin * 2) / 2
  // Pie chart colors
  const color = d3
    .scaleOrdinal()
    .domain(data.map(d => d.name))
    .range(["maroon", "olivedrab"])
  // Pervious land area data object
  const pervData = [
    {
      name: "pervious_pct",
      value: d3.sum(data, d => d["pervious_pct"] * d.area),
      dataset: data
    },
    {
      name: "impervious_pct",
      value: d3.sum(data, d => d["impervious_pct"] * d.area),
      dataset: data
    }
  ]

  // Create functions for pie chart and labels
  const pie = d3.pie().value(d => d.value)
  const arc = d3.arc().innerRadius(0).outerRadius(radius)
  const arcs = pie(pervData)
  const arcLabel = d3
    .arc()
    .innerRadius(radius * 0.6)
    .outerRadius(radius * 0.6)

  // Hide the text that's displayed when no polygons are selected
  d3.select("#pie-container #pie-blank")
    .classed("d-none", true)
    .classed("d-block", false)
  d3.select("#pie-container").selectAll("svg, h5, p").remove()

  // Pie chart container
  const svg = d3
    .select("#pie-container")
    .append("svg")
    .attr("id", "perv-pie")
    .attr("preserveAspectRatio", "xMidYMax meet")
    .attr("viewBox", [-width / 2, -height / 2, width, height])

  // Add pie chart
  svg
    .append("g")
    .attr("stroke", "white")
    .attr("stroke-width", 5)
    .selectAll("path")
    .data(arcs)
    .join("path")
    .attr("prop", d => d.data.name)
    .attr("d", arc)
    .attr("fill", d => color(d.data.name))
    .append("svg:title")
    .text(d => capitalize(d.data.name.split("_")[0]))

  // Add text/labels
  svg
    .append("g")
    .attr("font-family", "sans-serif")
    .attr("font-size", "1.2em")
    .attr("text-anchor", "middle")
    .selectAll("text")
    .data(arcs)
    .join("text")
    .attr("fill", "white")
    .attr("transform", d => `translate(${arcLabel.centroid(d)})`)
    // Pervious/impervious label
    .call(text =>
      text
        .append("tspan")
        .attr("y", "-0.4em")
        .attr("font-weight", "bold")
        .text(d => capitalize(d.data.name.split("_")[0]))
        .append("svg:title")
        .text(d => capitalize(d.data.name.split("_")[0]))
    )
    // Acreage label
    .call(text =>
      text
        .filter(d => d.endAngle - d.startAngle > 0.25)
        .append("tspan")
        .attr("x", 0)
        .attr("y", "0.8em")
        .attr("fill-opacity", 0.8)
        .text(
          d =>
            (d.data.value / 43560.0).toFixed(0).toLocaleString("en") + " acres"
        )
        .append("svg:title")
        .text(d => capitalize(d.data.name.split("_")[0]))
    )

  // If more than one polygon is selected add drill down functionality to chart
  if (attrArray.length > 1) {
    // Events on the pie sectors
    d3.selectAll("#pie-container path")
      .on("mouseover", (e, d) => {
        d3.select(e.target).attr("opacity", 0.7)
        d3.select(e.target).style("cursor", "pointer")
      })
      .on("mouseout", (e, d) => {
        d3.select(e.target).attr("opacity", 1)
        d3.select(e.target).style("cursor", "pointer")
      })
      .on("click", drillDown)

    // Events on sector labels
    d3.selectAll("#pie-container text")
      .on("mouseover", (e, d) => {
        d3.select("#perv-pie")
          .selectAll(`[prop=${d.data.name}]`)
          .attr("opacity", 0.7)
        d3.select(e.target).style("cursor", "pointer")
      })
      .on("mouseout", (e, d) => {
        d3.select("#perv-pie")
          .selectAll(`[prop=${d.data.name}]`)
          .attr("opacity", 1)
        d3.select(e.target).style("cursor", "pointer")
      })
      .on("click", drillDown)

    // Instructory text
    $("#pie-container").append(
      $("<p>")
        .attr("id", `ratio-title`)
        .css("font-size", "1.3em")
        .addClass(["text-wrap", "text-center", "p-0", "m-0"])
        .text("Select a sector to drill down and reveal additional data.")
    )

    // Also change the title
    title = "Pervious vs Impervious Land Area for Selected NTAs"
  }

  // Pie chart title
  $("#pie-container").prepend(
    $("<h5>")
      .attr("id", `ratio-title`)
      .addClass(["text-wrap", "font-weight-bold", "text-center", "p-0", "m-0"])
      .text(title)
  )
}

// Drill down function when clicking on pie chart sector
const drillDown = (e, d) => {
  const data = d.data.dataset
  const value = d.data.name

  const margin = 10
  const height = (width =
    $(window).width() > 768
      ? $(".leaflet-sidebar-pane").width()
      : $(window).width() - 40)
  const radius = Math.min(width - margin * 2, height - margin * 2) / 2

  // Spectral pie chart sector coloring
  const color =
    value === "impervious_pct"
      ? d3
          .scaleSequential()
          .domain([0, data.length])
          .interpolator(d3.interpolateSpectral)
      : d3
          .scaleSequential()
          .domain([data.length, 0])
          .interpolator(d3.interpolateSpectral)

  const pie = d3.pie().value(d => d[value])
  const arc = d3
    .arc()
    // Inner radius value creates a donut pie chart
    .innerRadius(radius - width / 8)
    .outerRadius(radius)
    .padAngle(d => 1)
    .padRadius(2)
    .cornerRadius(5)
  const arcs = pie(data)
  const arcLabel = d3
    .arc()
    .innerRadius(radius * 0.87)
    .outerRadius(radius * 0.87)

  // Clear pie chart pane before adding new svgs
  d3.select("#pie-container").selectAll("svg, h5, p").remove()

  $("#pie-container").append(
    $("<h5>")
      .attr("id", `ratio-title`)
      .addClass(["text-wrap", "font-weight-bold", "text-center", "p-0", "m-0"])
      .text(
        `Percent Area of ${d3
          .select(e.target)
          .select("title")
          .text()} Land for Selected NTAs`
      )
  )

  const svg = d3
    .select("#pie-container")
    .append("svg")
    .attr("preserveAspectRatio", "xMidYMax meet")
    .attr("viewBox", [-width / 2, -height / 2, width, height])

  // Donut pie chart
  svg
    .append("g")
    .classed("svg-arcs", true)
    .attr("stroke", "white")
    .selectAll("path")
    .data(arcs)
    .join("path")
    .on("mouseover", (e, d) => highlightSelected(null, d.data))
    .on("mouseout", (e, d) => {
      if (!geoidArray.map(d => d.geoid).includes(d.data.geoid))
        unhighlightSelected(null, d.data)
    })
    .on("click", (e, d) => leaveHighlight(null, d.data))
    .attr("geoid", d => d.data.geoid)
    .attr("d", arc)
    .attr("fill", d => color(d.index))
    .attr("stroke", d => {
      if (geoidArray.map(d => d.geoid).includes(d.data.geoid)) return "black"
    })
    .attr("stroke-width", d => {
      if (geoidArray.map(d => d.geoid).includes(d.data.geoid)) return 2
    })
    .append("svg:title")
    .text(d => d.data.neighborhood)

  // Pie chart Labels
  svg
    .append("g")
    .attr("font-family", "sans-serif")
    .attr("font-size", "0.8em")
    .classed("shadow-stroke", true)
    .selectAll("text")
    .data(arcs)
    .join("text")
    .on("mouseover", (e, d) => highlightSelected(null, d.data))
    .on("mouseout", (e, d) => {
      if (!geoidArray.map(d => d.geoid).includes(d.data.geoid))
        unhighlightSelected(null, d.data)
    })
    .on("click", (e, d) => leaveHighlight(null, d.data))
    .attr("transform", function (d) {
      const midAngle =
        d.endAngle < Math.PI
          ? d.startAngle / 2 + d.endAngle / 2
          : d.startAngle / 2 + d.endAngle / 2 + Math.PI
      return (
        "translate(" +
        arcLabel.centroid(d)[0] +
        "," +
        arcLabel.centroid(d)[1] +
        ") rotate(-90) rotate(" +
        (midAngle * 180) / Math.PI +
        ")"
      )
    })
    .attr("dy", ".35em")
    .attr("text-anchor", "middle")
    .text(d => (data.length <= 40 ? d3.format(".1%")(d.data[value]) : null))
    .append("svg:title")
    .text(d => d.data.neighborhood)

  // Add a circle in the center that represents selected pie chart sector
  const circle = d3.select("#pie-container svg").append("g")

  circle
    .append("circle")
    .on("mouseover", e => {
      d3.select(e.target).attr("opacity", 0.7)
      d3.select(e.target).style("cursor", "pointer")
    })
    .on("mouseout", e => d3.select(e.target).attr("opacity", 1))
    .on("click", e => createPies(data))
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", radius - width / 6)
    .attr("fill", value === "pervious_pct" ? "olivedrab" : "maroon")

  // Instructory text
  $("#pie-container")
    .append(
      $("<p>")
        .attr("id", `ratio-title`)
        .css("font-size", "1.3em")
        .addClass(["text-wrap", "text-center", "p-0", "m-0"])
        .text("Click center circle to go back up.")
    )
    .append(
      $("<p>")
        .attr("id", `ratio-title`)
        .addClass(["text-wrap", "text-center", "p-0", "m-0"])
        .html(`For percentage labels to show, select 40 or fewer NTAs.
        <br/>(${data.length} currently selected)`)
    )
}
