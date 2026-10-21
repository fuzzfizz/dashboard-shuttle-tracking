# Task 6 Report: Upgrade Telemetry Simulator for Multi-Vehicle Fleet

## Summary
Task 6 upgrades the Node.js telemetry simulation script (`tools/simulate.js`) to concurrently simulate a fleet of two shuttles (`shuttle-01` and `shuttle-02`) moving across Bangkok. Each vehicle publishes telemetry periodically to its dedicated MQTT topic `shuttle/fleet/v1/<vehicle_id>/telemetry`, enabling live end-to-end multi-vehicle dashboard testing.

## Key Changes
1. **Multi-Vehicle Array Definition (`tools/simulate.js`)**:
   - Configured `shuttle-01`: Bangkok coordinates (`13.7563, 100.5018`), initial speed `28.0 km/h`, heading `45.0°`, speed delta `3.5`.
   - Configured `shuttle-02`: Bangkok coordinates (`13.7460, 100.5340`), initial speed `18.5 km/h`, heading `135.0°`, speed delta `2.5`.
2. **Concurrent Publishing Loop**:
   - Every 1500ms, both vehicles compute smooth delta updates to position, speed, and heading.
   - Publishes to `shuttle/fleet/v1/<vehicle_id>/telemetry` with QoS 0.
   - Formatted payload includes `vehicle_id`, `lat`, `lng`, `speed`, `heading`, and `timestamp`.
   - Console logs each vehicle's updated position and speed with a timestamp.

## Verification Results
- **Node.js Syntax Check**: `node --check tools/simulate.js` passed cleanly with exit code 0.
- **Frontend Test Suite**: `npm test --prefix frontend -- --run` verified that all 8 test files and 22 tests pass cleanly with 0 regressions.

## Commits Created
- `de38fc2`: `feat(tools): simulate multi-vehicle fleet telemetry concurrently`
