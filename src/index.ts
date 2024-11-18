import express, { Request, Response } from "express";
import 'dotenv/config';

const MAX_CAPACITY = parseInt(process.env.MAX_CAPACITY??'100');
const SAFE_CAPACITY = parseInt(process.env.SAFE_CAPACITY??'92');
const DEVICE_MAX_CAPACITY = parseInt(process.env.DEVICE_MAX_CAPACITY??'40');

interface Device {
  id: string;
  consumption: number;
}

let queue: Device[] = [];
let currentUsage: number = 0;

function allocatePower(exceptDevice:Device|null=null): void {
    let remainingCapacity = SAFE_CAPACITY - currentUsage;
  
    for (const device of queue) {
        if(exceptDevice==device) {
            continue;
        }
      if (remainingCapacity <= 0) break;
  
      const requiredPower = Math.min(
        DEVICE_MAX_CAPACITY - device.consumption,
        remainingCapacity
      );
  
      if (requiredPower > 0) {
        device.consumption += requiredPower;
        currentUsage += requiredPower;
        remainingCapacity -= requiredPower;
      }
    }
  }

function addDevice(deviceId: string): string {
  if (queue.some(device => device.id === deviceId)) {
    return `Device ${deviceId} is already connected.`;
  }

  queue.push({ id: deviceId, consumption: 0 });
  allocatePower();
  return `Device ${deviceId} connected successfully.`;
}

function removeDevice(deviceId: string): string {
  const deviceIndex = queue.findIndex(device => device.id === deviceId);

  if (deviceIndex === -1) {
    return `Device ${deviceId} not found.`;
  }

  const device = queue[deviceIndex];
  currentUsage -= device.consumption;
  queue.splice(deviceIndex, 1);

  allocatePower();
  return `Device ${deviceId} disconnected successfully.`;
}

function changeConsumption(deviceId: string, newConsumption: number): string {
    const device = queue.find((device) => device.id === deviceId);
  
    if (!device) {
      return `Device ${deviceId} not found.`;
    }
  
    const delta = newConsumption - device.consumption;
  
    if (delta > 0 && currentUsage + delta > SAFE_CAPACITY) {
      return `Unable to increase consumption for device ${deviceId}. Not enough capacity.`;
    }
  
    currentUsage += delta;
    device.consumption = newConsumption;
    allocatePower(device);
    return `Device ${deviceId} consumption updated to ${newConsumption} units.`;
  }

const app = express();
app.use(express.json());

app.post("/devices/connect", (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Device ID is required." });
  }
  const message = addDevice(id);
  res.json({ message, currentUsage, queue });
});

app.post("/devices/disconnect", (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Device ID is required." });
  }
  const message = removeDevice(id);
  res.json({ message, currentUsage, queue });
});

app.post("/devices/update", (req: Request, res: Response) => {
  const { id, consumption } = req.body;
  if (!id || consumption === undefined) {
    return res.status(400).json({ error: "Device ID and consumption are required." });
  }
  if (consumption < 0 || consumption > DEVICE_MAX_CAPACITY) {
    return res.status(400).json({
      error: `Consumption must be between 0 and ${DEVICE_MAX_CAPACITY}.`,
    });
  }
  const message = changeConsumption(id, consumption);
  res.json({ message, currentUsage, queue });
});

app.get("/status", (req: Request, res: Response) => {
  res.json({ currentUsage, queue });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
