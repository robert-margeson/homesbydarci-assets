(function(){
  'use strict';

  var cfg = window.__OTTO_CONFIG;
  if (!cfg) return;

  var RECHECK_INTERVAL = 3000;
  var MAX_RECHECK_DURATION = 30000;

  var ottoState = {
    uuid: null,
    intervalId: null,
    initialized: false
  };

  var log = function(message, data) {
    if (cfg.DEBUG) console.log('[Otto Client] ' + message, data || '');
  };

  var extractUUID = function() {
    var ottoMeta = document.querySelector('meta[name="otto"]');
    if (ottoMeta) {
      var content = ottoMeta.getAttribute('content');
      var match = content.match(/uuid=([^;]+)/);
      if (match) return match[1];
    }
    var selectors = ['#sa-otto', '#searchatlas', '#sa-dynamic-optimization'];
    for (var i = 0; i < selectors.length; i++) {
      var element = document.querySelector(selectors[i]);
      if (element) return element.getAttribute('data-uuid');
    }
    return null;
  };

  var cleanupExistingElements = function() {
    var safeToRemoveElements = ['SCRIPT', 'META'];
    var selectors = [
      'meta[name="otto"][content*="type=wordpress"]',
      'meta[name="otto"][content*="type=cms_integration"]',
      '[data-otto-pixel="searchatlas"]',
      'script[src*="dynamic_optimization.js"]',
      'script#searchatlas'
    ];
    selectors.forEach(function(selector) {
      var elements = document.querySelectorAll(selector);
      elements.forEach(function(el) {
        if (safeToRemoveElements.indexOf(el.tagName) !== -1) {
          log('Removing duplicate Otto element: ' + el.tagName);
          el.remove();
        } else {
          log('Skipping removal of structural element: ' + el.tagName);
          el.removeAttribute('data-otto-pixel');
        }
      });
    });
  };

  var logPerformanceMetrics = function() {
    if (!ottoState.uuid) return;
    try {
      var resources = performance.getEntriesByType('resource');
      var totalResponseTime = resources.reduce(function(sum, r) {
        return sum + (r.responseEnd - r.startTime);
      }, 0);
      var averageResponseTime = resources.length > 0
        ? (totalResponseTime / resources.length).toFixed(2) : null;
      var totalDownloadSize = resources.reduce(function(sum, r) {
        return sum + (r.transferSize || 0);
      }, 0);
      var metrics = {
        otto_uuid: ottoState.uuid,
        url: window.location.href,
        user_agent: navigator.userAgent,
        context: 'client-side',
        average_response_time: averageResponseTime,
        total_download_size_kb: (totalDownloadSize / 1024).toFixed(2)
      };
      fetch(cfg.API_BASE + '/api/v2/otto-page-crawl-logs/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });
      log('Performance metrics logged', metrics);
    } catch (error) {
      log('Performance logging failed: ' + error.message);
    }
  };

  var applyClientSideOptimizations = function(data) {
    if (Array.isArray(data.header_replacements)) {
      data.header_replacements.forEach(function(meta) {
        if (meta.type === 'title') {
          var titleEl = document.querySelector('title');
          if (titleEl && titleEl.textContent !== meta.recommended_value) {
            titleEl.textContent = meta.recommended_value;
            log('Updated title: ' + meta.recommended_value);
          }
        }
      });
    }
    if (data.body_substitutions && data.body_substitutions.images) {
      Object.entries(data.body_substitutions.images).forEach(function(entry) {
        var imageUrl = entry[0], altText = entry[1];
        var images = document.querySelectorAll('img[src="' + imageUrl + '"], img[data-src="' + imageUrl + '"]');
        images.forEach(function(img) {
          if (!img.alt || img.alt === '') {
            img.alt = altText;
            log('Added alt text to dynamically loaded image: ' + altText);
          }
        });
      });
    }
  };

  var recheckForOptimizations = function() {
    if (!ottoState.uuid) return;
    fetch(
      cfg.API_BASE + '/api/v2/otto-url-details/?url=' +
      encodeURIComponent(window.location.href) + '&uuid=' + ottoState.uuid
    ).then(function(response) {
      if (!response.ok) return;
      return response.json();
    }).then(function(data) {
      if (data) applyClientSideOptimizations(data);
    }).catch(function(error) {
      log('Recheck failed: ' + error.message);
    });
  };

  var setupSPAHandling = function() {
    var originalPushState = history.pushState;
    var originalReplaceState = history.replaceState;
    var handleRouteChange = function() {
      log('Route change detected, cleaning up and reprocessing');
      cleanupExistingElements();
      if (ottoState.intervalId) clearInterval(ottoState.intervalId);
      setTimeout(function() { initializeOptimizations(); }, 100);
    };
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      handleRouteChange();
    };
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      handleRouteChange();
    };
    window.addEventListener('popstate', handleRouteChange);
    log('SPA handling initialized');
  };

  var initializeOptimizations = function() {
    if (!ottoState.uuid) {
      ottoState.uuid = extractUUID();
      if (!ottoState.uuid) {
        log('No UUID found, skipping client-side optimizations');
        return;
      }
    }
    log('Initializing optimizations with UUID: ' + ottoState.uuid);
    logPerformanceMetrics();
    ottoState.intervalId = setInterval(recheckForOptimizations, RECHECK_INTERVAL);
    setTimeout(function() {
      if (ottoState.intervalId) {
        clearInterval(ottoState.intervalId);
        ottoState.intervalId = null;
        log('Optimization interval cleared after max duration');
      }
    }, MAX_RECHECK_DURATION);
  };

  if (ottoState.initialized) return;
  ottoState.initialized = true;
  log('Otto client script initializing');
  cleanupExistingElements();
  setupSPAHandling();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOptimizations);
  } else {
    initializeOptimizations();
  }
  window.addEventListener('load', function() {
    setTimeout(logPerformanceMetrics, 1000);
  });
  window.otto_client_installed = true;
})();
