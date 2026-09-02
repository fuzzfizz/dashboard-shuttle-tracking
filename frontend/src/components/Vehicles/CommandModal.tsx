"use client";

import React, { useState, useEffect } from 'react';
import { X, Activity, RefreshCw, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Vehicle } from '@/lib/types';
import { api } from '@/lib/api';
import { adminWs } from '@/lib/ws';
import { validateCommandPayload } from '@/lib/vehicle-utils';

interface CommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
}

export default function CommandModal({ isOpen, onClose, vehicle }: CommandModalProps) {
  const [command, setCommand] = useState('set_interval');
  const [intervalMs, setIntervalMs] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCommand('set_interval');
      setIntervalMs(5000);
      setStatus(null);
    }
  }, [isOpen, vehicle]);

  useEffect(() => {
    if (!isOpen || !vehicle) return;

    const unsub = adminWs.subscribe('command:response', (data) => {
      if (data.vehicle_id === vehicle.id) {
        setStatus({
          type: data.success ? 'success' : 'error',
          message: data.message || (data.success ? 'Command executed successfully.' : 'Command failed.')
        });
        setLoading(false);
      }
    });

    return () => unsub();
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const handleSendCommand = async () => {
    setStatus(null);
    const params = command === 'set_interval' ? { interval: intervalMs } : {};
    
    if (!validateCommandPayload(command, params)) {
      setStatus({ type: 'error', message: 'Invalid command payload' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: 'Sending command...' });

    try {
      await api.vehicles.sendCommand(vehicle.id, command, params);
      // Wait for WS response or timeout
      setTimeout(() => {
        setLoading(prev => {
          if (prev) {
            setStatus({ type: 'error', message: 'Command timed out (No response from device).' });
            return false;
          }
          return prev;
        });
      }, 10000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to send command' });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-500" />
            Remote Command
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
            Sending command to: <strong>{vehicle.plate_number}</strong>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Command</label>
            <select
              value={command}
              onChange={e => setCommand(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="set_interval">Set Telemetry Interval</option>
              <option value="reboot">Reboot Device</option>
              <option value="check_ota">Check OTA Updates</option>
            </select>
          </div>

          {command === 'set_interval' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interval</label>
              <select
                value={intervalMs}
                onChange={e => setIntervalMs(Number(e.target.value))}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={1000}>1000ms (1s)</option>
                <option value={2000}>2000ms (2s)</option>
                <option value={5000}>5000ms (5s)</option>
                <option value={10000}>10000ms (10s)</option>
                <option value={30000}>30000ms (30s)</option>
              </select>
            </div>
          )}

          {status && (
            <div className={`p-3 rounded text-sm flex items-start ${
              status.type === 'success' ? 'bg-green-50 text-green-700' :
              status.type === 'error' ? 'bg-red-50 text-red-700' :
              'bg-blue-50 text-blue-700'
            }`}>
              {status.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />}
              {status.type === 'error' && <AlertCircle className="w-5 h-5 mr-2 shrink-0" />}
              {status.type === 'info' && <RefreshCw className="w-5 h-5 mr-2 shrink-0 animate-spin" />}
              <span>{status.message}</span>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={handleSendCommand}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Command
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
