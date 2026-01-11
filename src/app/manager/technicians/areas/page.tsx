'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon, PlusIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline';

// Types
type Area = {
    id: number;
    name: string;
};

type Tech = {
    id: string;
    name: string;
};

type Assignment = {
    id: number;
    technician_id: string;
    area: string; // The table uses area name string currently
};

export default function TechnicianAreasPage() {
    const [techs, setTechs] = useState<Tech[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection for Merge
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Edit State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    // Add State
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        // 1. Get technicians
        const { data: techsData } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'technician')
            .order('name');

        // 2. Get existing assignments
        const { data: assignmentsData } = await supabase
            .from('technician_areas')
            .select('*');

        // 3. Get Areas (Single Source of Truth now)
        const { data: areasData } = await supabase
            .from('areas')
            .select('*')
            .order('name');
        
        // Fallback: If areas table is empty (script failed?), fallback to customers logic (Removed for now, assuming script ran)

        setTechs(techsData || []);
        setAssignments(assignmentsData || []);
        setAreas(areasData || []);
        setLoading(false);
    }

    // --- CRUD Operations ---

    // 1. Add
    const handleAdd = async () => {
        if (!newName.trim()) return;
        const normalized = newName.trim();

        // Check duplicate
        if (areas.some(a => a.name.toLowerCase() === normalized.toLowerCase())) {
            alert('Area already exists!');
            return;
        }

        const { error } = await supabase.from('areas').insert({ name: normalized });
        if (error) {
            alert(error.message);
        } else {
            setNewName('');
            setIsAdding(false);
            loadData();
        }
    };

    // 2. Edit (Rename)
    const startEdit = (area: Area) => {
        setEditingId(area.id);
        setEditName(area.name);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editName.trim()) return;
        const oldArea = areas.find(a => a.id === editingId);
        if (!oldArea) return;

        const newNameTrimmed = editName.trim();
        if (newNameTrimmed === oldArea.name) {
            setEditingId(null);
            return;
        }

        // 1. Update Area Table
        const { error: areaError } = await supabase
            .from('areas')
            .update({ name: newNameTrimmed })
            .eq('id', editingId);

        if (areaError) {
            alert('Error updating area name: ' + areaError.message);
            return;
        }

        // 2. Propagate to Customers
        await supabase
            .from('customers')
            .update({ area: newNameTrimmed })
            .eq('area', oldArea.name);

        // 3. Propagate to Technician Assignments
        await supabase
            .from('technician_areas')
            .update({ area: newNameTrimmed })
            .eq('area', oldArea.name);

        setEditingId(null);
        loadData();
    };

    // 3. Delete
    const handleDelete = async (area: Area) => {
        if (!confirm(`Are you sure you want to delete "${area.name}"?`)) return;

        // 1. Check usage (optional, but good UX) - for now just warn in prompt
        // "This will remove the area from all Customers assigned to it."
        
        // 2. Set Customers Area to NULL
        await supabase
            .from('customers')
            .update({ area: null })
            .eq('area', area.name);

        // 3. Delete Assignments
        await supabase
            .from('technician_areas')
            .delete()
            .eq('area', area.name);

        // 4. Delete Area
        const { error } = await supabase
            .from('areas')
            .delete()
            .eq('id', area.id);

        if (error) alert(error.message);
        else loadData();
    };

    // 4. Merge
    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleMerge = async () => {
        if (selectedIds.size < 2) return;
        
        // Pick primary
        const selectedAreas = areas.filter(a => selectedIds.has(a.id));
        const primaryName = prompt(
            `Merge ${selectedAreas.length} areas: ${selectedAreas.map(a => a.name).join(', ')}\n\nEnter the EXACT name of the area to keep (others will be merged into it):`,
            selectedAreas[0].name
        );

        if (!primaryName) return;

        // Verify primary exists in selection
        const primary = selectedAreas.find(a => a.name === primaryName);
        if (!primary) {
            alert('Target area must be one of the selected areas.');
            return;
        }

        const others = selectedAreas.filter(a => a.id !== primary.id);

        // Execute Merge
        for (const other of others) {
            // 1. Move Customers
            await supabase
                .from('customers')
                .update({ area: primary.name })
                .eq('area', other.name);

            // 2. Update/Merge Assignments
            // logic: update to new name. if new name already exists for that tech, it might duplicate. 
            // Ideally we delete duplicates, but simplified: just update. Tech Areas ID is PK.
            // Postgres will error on update unique violation if there is a constraint? 
            // The table likely doesn't have a unique constraint on (tech_id, area) unless we added it.
            // Safe bet: Delete 'other' assignments if 'primary' assignment exists, else update.
            
            // Fetch assignments for 'other'
            const { data: otherAssigns } = await supabase
                .from('technician_areas')
                .select('*')
                .eq('area', other.name);

            if (otherAssigns) {
                for (const assign of otherAssigns) {
                    // Check if target exists
                    const { data: existing } = await supabase
                        .from('technician_areas')
                        .select('id')
                        .eq('technician_id', assign.technician_id)
                        .eq('area', primary.name)
                        .single();
                    
                    if (existing) {
                        // Conflict: Tech already has Primary. Just delete the Other assignment.
                        await supabase.from('technician_areas').delete().eq('id', assign.id);
                    } else {
                        // Move assignment
                        await supabase.from('technician_areas').update({ area: primary.name }).eq('id', assign.id);
                    }
                }
            }

            // 3. Delete 'Other' Area
            await supabase.from('areas').delete().eq('id', other.id);
        }

        alert('Merge complete.');
        setSelectedIds(new Set());
        loadData();
    };


    async function toggleAssignment(technicianId: string, areaName: string) {
        const existing = assignments.find(
            (a) => a.technician_id === technicianId && a.area === areaName
        );

        if (existing) {
            await supabase.from('technician_areas').delete().eq('id', existing.id);
        } else {
            await supabase.from('technician_areas').insert({ technician_id: technicianId, area: areaName });
        }
        loadData();
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Technician Area Assignment</h1>
                <div className="flex gap-2">
                    {selectedIds.size >= 2 && (
                        <Button 
                            variant="secondary" 
                            className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200"
                            onClick={handleMerge}
                        >
                            <ArrowsPointingInIcon className="w-4 h-4 mr-2" />
                            Merge ({selectedIds.size})
                        </Button>
                    )}
                    <Button onClick={() => setIsAdding(true)}>
                        <PlusIcon className="w-4 h-4 mr-2" /> 
                        Add Area
                    </Button>
                </div>
            </div>

            {/* Add Row */}
            {isAdding && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-end gap-3 max-w-lg">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-blue-700 mb-1">New Area Name</label>
                        <input 
                            type="text" 
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="w-full px-3 py-2 border rounded shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                        />
                    </div>
                    <Button onClick={handleAdd} size="sm">Save</Button>
                    <Button variant="ghost" onClick={() => setIsAdding(false)} size="sm" className="text-gray-500">Cancel</Button>
                </div>
            )}

            <Card>
                {loading ? <p className="p-8 text-center text-gray-500">Loading areas...</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border-collapse">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border px-4 py-2 w-10 text-center">
                                        <input 
                                            type="checkbox" 
                                            disabled 
                                            className="rounded border-gray-300" 
                                            title="Select rows to merge"
                                        />
                                    </th>
                                    <th className="border px-4 py-2 text-left font-medium text-gray-600 min-w-[200px]">Area</th>
                                    {techs.map((t) => (
                                        <th key={t.id} className="border px-4 py-2 text-center font-medium text-gray-600 w-24">{t.name}</th>
                                    ))}
                                    <th className="border px-2 py-2 text-center font-medium text-gray-600 w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {areas.map((area) => (
                                    <tr key={area.id} className={`hover:bg-gray-50 group ${selectedIds.has(area.id) ? 'bg-purple-50' : ''}`}>
                                        <td className="border px-4 py-2 text-center">
                                            <input 
                                                type="checkbox"
                                                checked={selectedIds.has(area.id)}
                                                onChange={() => toggleSelection(area.id)}
                                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                            />
                                        </td>
                                        
                                        <td className="border px-4 py-2 font-semibold text-gray-800">
                                            {editingId === area.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                    <button onClick={handleSaveEdit} className="text-green-600 hover:bg-green-100 p-1 rounded"><CheckIcon className="w-4 h-4"/></button>
                                                    <button onClick={() => setEditingId(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><XMarkIcon className="w-4 h-4"/></button>
                                                </div>
                                            ) : (
                                                <span>{area.name}</span>
                                            )}
                                        </td>

                                        {techs.map((t) => {
                                            const assigned = assignments.some(
                                                (a) => a.technician_id === t.id && a.area === area.name
                                            );
                                            return (
                                                <td key={t.id} className="border px-4 py-2 text-center">
                                                    <button
                                                        onClick={() => toggleAssignment(t.id, area.name)}
                                                        className={`w-full py-1 rounded text-xs transition-colors ${assigned
                                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                                : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {assigned ? '✓' : '-'}
                                                    </button>
                                                </td>
                                            );
                                        })}

                                        <td className="border px-2 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => startEdit(area)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Rename"
                                                >
                                                    <PencilSquareIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(area)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {areas.length === 0 && <p className="p-4 text-center text-gray-500">No areas found. Add one to get started.</p>}
                    </div>
                )}
            </Card>
        </div>
    );
}
