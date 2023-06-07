import { assertInventoryItem, Miner } from "wemine-apis";

export function isHashRateWithinBounds(params: {
  miner: Miner;
  actualHashRate: number;
}) {
  const inventoryItem = params.miner.inventoryItem;
  assertInventoryItem(inventoryItem);

  const expectedHashRateRange =
    inventoryItem.operationalMetadata?.minerMetadata?.expectedHashRateRange;
  return (
    !!expectedHashRateRange &&
    expectedHashRateRange.minimum <= params.actualHashRate &&
    params.actualHashRate <= expectedHashRateRange.maximum
  );
}

export function isFanSpeedWithinBounds(params: {
  miner: Miner;
  actualFanSpeed: number;
}) {
  const inventoryItem = params.miner.inventoryItem;
  assertInventoryItem(inventoryItem);

  const expectedFanSpeedRange =
    inventoryItem.operationalMetadata?.minerMetadata?.expectedFanSpeedRange;
  return (
    !!expectedFanSpeedRange &&
    expectedFanSpeedRange.minimum <= params.actualFanSpeed &&
    params.actualFanSpeed <= expectedFanSpeedRange.maximum
  );
}

export function isInletTempWithinBounds(params: {
  miner: Miner;
  actualTemperature: number;
}) {
  const inventoryItem = params.miner.inventoryItem;
  assertInventoryItem(inventoryItem);

  const expectedInletTempRange =
    inventoryItem.operationalMetadata?.minerMetadata?.expectedInletTempRange;
  return (
    !!expectedInletTempRange &&
    expectedInletTempRange.minimum <= params.actualTemperature &&
    params.actualTemperature <= expectedInletTempRange.maximum
  );
}

export function isOutletTempWithinBounds(params: {
  miner: Miner;
  actualTemperature: number;
}) {
  const inventoryItem = params.miner.inventoryItem;
  assertInventoryItem(inventoryItem);

  const expectedOutletTempRange =
    inventoryItem.operationalMetadata?.minerMetadata?.expectedOutletTempRange;
  return (
    !!expectedOutletTempRange &&
    expectedOutletTempRange.minimum <= params.actualTemperature &&
    params.actualTemperature <= expectedOutletTempRange.maximum
  );
}
