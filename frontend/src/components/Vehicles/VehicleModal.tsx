"use client";

import React, { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { Vehicle, Route } from '@/lib/types';
import { api } from '@/lib/api';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle?: Vehicle | null;
  routes: Route[];
  onSuccess: (savedVehicle: Vehicle, isNew: boolean) => void;
}

export default function VehicleModal({ isOpen, onClose, vehicle, routes, onSuccess }: VehicleModalProps) {
  const [plateNumber, setPlateNumber] = useState('');
  const [model, setModel] = useState('');
  const [routeId, setRouteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (vehicle) {
        setPlateNumber(vehicle.plate_number || '');
        setModel(vehicle.model || '');
        setRouteId(vehicle.current_route_id || '');
      } else {
        setPlateNumber('');
        setModel('');
        setRouteId('');
      }
      setError(null);
      setNewApiKey(null);
      setCopied(false);
    }
  }, [isOpen, vehicle]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = {
        plate_number: plateNumber,
        model,
        current_route_id: routeId || null,
      };

      if (vehicle) {
        const updated = await api.vehicles.update(vehicle.id, data);
        onSuccess(updated, false);
      } else {
        const created = await api.vehicles.create(data);
        if (created.device_api_key) {
          setNewApiKey(created.device_api_key);
        }
        onSuccess(created, true);
        if (!created.device_api_key) {
          onClose(); // close if no api key returned
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save vehicle');
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{vehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {newApiKey ? (
          <div className="p-6 flex flex-col items-center">
            <div className="bg-green-50 text-green-800 p-4 rounded-md mb-6 w-full text-sm">
              <p className="font-semibold mb-1">Vehicle Created Successfully!</p>
              <p>Please save the device API key below. It will not be shown again.</p>
            </div>
            
            <div className="w-full flex items-center space-x-2 bg-gray-100 p-3 rounded border">
              <code className="flex-1 text-sm break-all">{newApiKey}</code>
              <button
                onClick={copyApiKey}
                className="flex items-center p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                title="Copy Device Key"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-6 w-full py-2 px-4 bg-gray-800 text-white rounded hover:bg-gray-900 transition"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plate Number</label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={e => setPlateNumber(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. AB-1234"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Model</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Toyota Commuter"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Route</label>
              <select
                value={routeId}
                onChange={e => setRouteId(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Unassigned</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
