var $ = require('jQuery')
var cookies = global.cookies
const FILTERS_COOKIE_NAME = 'ea_action_chooser_filters'
$(document).ready(function () {
  var filterProps = ['occupation', 'timecommitment', 'duration', 'familiarity']
  var filterEls = filterProps.map(function (prop) {
    return $('.action-chooser-filter-' + prop)
  })
  // load filters
  var existingFilters = loadFilters()
  $.each(filterProps, function (index, prop) {
    if (existingFilters[prop]) filterEls[index].val(existingFilters[prop])
  })
  applyFilters(existingFilters)
  // bind filters
  $.each(filterEls, function (index, el) {
    el.change(applyFilters)
  })
  // bind clear filters button
  $('.action-chooser-clear-filters-button').click(clearFilters)
  // get filters
  function getFilters () {
    const filters = {}
    $.each(filterEls, function (index, el) {
      if (!el.val()) return
      filters[filterProps[index]] = el.val() 
    })
    return filters
  }
  // apply filters
  function applyFilters () {
    var filters = getFilters()
    console.log(filters)
    var actions = $('.action-chooser-action')
    actions.each(function () {
      var action = $(this)
      var show = true
      $.each(filterProps, function (index, prop) {
        var criterion = filters[prop]
        if (!show || !criterion) return // don't bother executing if we're already hidden or there isn't a filter
        var data = false
        try {
          data = JSON.parse(action.attr('data-action-' + prop))
        } catch (err) {
          console.error(err)
        }
        if (data && data.length && data.indexOf(criterion) === -1) show = false
      })
      saveFilters(filters)
      return show ? action.show() : action.hide()
    })
  }
  // clear filters
  function clearFilters () {
    $.each(filterEls, function (index, el) {
      el.val('')
    })
    applyFilters({})
  }
  // load filters
  function loadFilters () {
    var filters = {}
    try {
      const val = cookies.get(FILTERS_COOKIE_NAME)
      if (val) filters = JSON.parse(val)
    }
    catch (err) {
      console.log(err)
    }
    return filters
  }
  // save filters
  function saveFilters (filters) {
    try {
      cookies.set(FILTERS_COOKIE_NAME, JSON.stringify(filters))
    } catch (err) {
      console.error(err)
    }
  }
})

