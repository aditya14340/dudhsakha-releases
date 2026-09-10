import { supabase } from './supabase';

export const sendPasswordReset = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return data;
};
export const getFarmerCollections = async (farmerId, dairyId) => {
    const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('dairy_id', dairyId)
        .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getFarmerPayments = async (farmerId, dairyId) => {
    const { data, error } = await supabase
        .from('bill_payments')
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('dairy_id', dairyId)
        .order('payment_date', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getFarmers = async (dairyId) => {
    const { data, error } = await supabase
        .from('farmers')
        .select('*')
        .eq('dairy_id', dairyId)
        .order('code', { ascending: true });
    if (error) throw error;
    return data || [];
};


export const addFarmer = async (farmer) => {
    if (!farmer.dairy_id) throw new Error("dairy_id is required for farmer");
    const { password, farmer_password, ...farmerData } = farmer;
    const customPassword = farmer_password || password;
    const { data, error } = await supabase
        .from('farmers')
        .insert([farmerData])
        .select()
        .single();
    if (error) throw error;
    if (data && data.phone) {
        try {
            const { error: fnErr } = await supabase.functions.invoke('create-auth-user', {
                body: { type: 'farmer', phone: data.phone, dairy_id: data.dairy_id, farmer_id: data.id, name: data.name, password: customPassword || undefined }
            });
            if (fnErr) console.warn('[API] Auth account creation failed (non-fatal):', fnErr.message);
            else console.log('[API] Auth account created for farmer:', data.phone);
        } catch (authErr) {
            console.warn('[API] Auth account creation error (non-fatal):', authErr?.message);
        }
    }
    return data;
};

export const updateFarmerPassword = async (farmerId, phone, newPassword, dairyId) => {
    if (!phone) throw new Error('Phone number is required to update password');
    if (!newPassword || newPassword.length < 6) throw new Error('Password must be at least 6 characters');
    const { data, error } = await supabase.functions.invoke('create-auth-user', {
        body: { type: 'farmer', phone, dairy_id: dairyId, farmer_id: farmerId, password: newPassword }
    });
    if (error) {
        let realMsg = error.message;
        try {
            if (error.context?.body) {
                const body = typeof error.context.body === 'string' ? JSON.parse(error.context.body) : error.context.body;
                if (body?.error) realMsg = body.error;
            }
        } catch (_) {}
        console.error('[API] updateFarmerPassword error:', realMsg, error);
        throw new Error(realMsg || 'Password update failed');
    }
    if (data?.error) throw new Error(data.error);
    return data;
};

export const updateFarmer = async (farmer, dairyId) => {
    const updates = { ...farmer };
    delete updates.password;
    delete updates.farmer_password;
    let query = supabase.from('farmers').update(updates).eq('id', farmer.id);
    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
};


export const softDeleteFarmer = async (id, dairyId) => {
    let query = supabase
        .from('farmers')
        .update({ is_deleted: true, deleted_at: new Date() })
        .eq('id', id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { error } = await query;
    if (error) throw error;
    return true;
};

export const getDeletedFarmers = async (dairyId) => {
    const { data, error } = await supabase
        .from('farmers')
        .select('*')
        .eq('dairy_id', dairyId)
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const restoreFarmer = async (id, dairyId) => {
    let query = supabase
        .from('farmers')
        .update({ is_deleted: false, deleted_at: null })
        .eq('id', id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { error } = await query;
    if (error) throw error;
    return true;
};

export const resetFarmerDevice = async (farmerId, dairyId) => {
    const { data, error } = await supabase
        .from('farmers')
        .update({ device_id: null })
        .eq('id', farmerId)
        .eq('dairy_id', dairyId)
        .select()
        .single();
        
    if (error) throw error;
    return data;
};

export const permanentDeleteFarmer = async (id, dairyId) => {
    let query = supabase
        .from('farmers')
        .delete()
        .eq('id', id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { error } = await query;
    if (error) throw error;
    return true;
};



export const getCollections = async (dairyId, date = null) => {
    let query = supabase
        .from('collections')
        .select('*, farmers!inner(name, code)')
        .eq('dairy_id', dairyId);
    if (date) query = query.eq('date', date);
    const { data, error } = await query.order('id', { ascending: false });
    if (error) throw error;
    return (data || []).map(entry => ({
        ...entry,
        farmer_name: entry.farmers?.name,
        farmer_code: entry.farmers?.code
    }));
};

export const addCollection = async (collection) => {
    // Ensure dairy_id is present for isolation
    if (!collection.dairy_id) throw new Error("dairy_id is required for collection");

    // Remove id from collection data if it exists
    const { id: _id, ...dataToInsert } = collection;

    const { data, error } = await supabase
        .from('collections')
        .insert([dataToInsert])
        .select()
        .maybeSingle();
    if (error) throw error;
    return data;
};

export const updateCollection = async (collection, dairyId) => {
    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');

    // Strip id and dairy_id from the SET payload — never update primary/tenant keys
    const { id: _id, dairy_id: _dId, ...fieldsToUpdate } = collection;

    const { data, error } = await supabase
        .from('collections')
        .update(fieldsToUpdate)
        .eq('id', collection.id)
        .eq('dairy_id', dairyId)
        .select()
        .maybeSingle();
    if (error) throw error;
    return data;
};

export const deleteCollection = async (id, dairyId) => {
    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    
    // Fetch the collection BEFORE deleting so we can clean up thev transactions
    const { data: oldCol } = await supabase
        .from('collections')
        .select('farmer_id, date')
        .eq('id', id)
        .single();
    
    const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id)
        .eq('dairy_id', dairyId);
    if (error) throw error;

    // Clean up all linked Thev transactions:
    // Step 1: Delete by reference_collection_id (modern entries)
    await supabase
        .from('thev_transactions')
        .delete()
        .eq('reference_collection_id', id)
        .eq('dairy_id', dairyId);

    // Step 2: Also delete legacy entries that match farmer_id + date but have no reference_collection_id
    if (oldCol && oldCol.farmer_id && oldCol.date) {
        const { data: legacyTxns } = await supabase
            .from('thev_transactions')
            .select('id')
            .eq('dairy_id', dairyId)
            .eq('farmer_id', oldCol.farmer_id)
            .eq('transaction_date', oldCol.date)
            .eq('transaction_type', 'deposit')
            .is('reference_collection_id', null);

        if (legacyTxns && legacyTxns.length > 0) {
            const ids = legacyTxns.map(t => t.id);
            await supabase.from('thev_transactions').delete().in('id', ids);
        }
    }
    
    return true;
};


export const getMemberStats = async (farmerId, dairyId) => {
    // Helper to calculate sums
    const calculateSum = (data) => {
        return data.reduce((acc, curr) => ({
            quantity: acc.quantity + (parseFloat(curr.quantity) || 0),
            amount: acc.amount + (parseFloat(curr.amount) || 0)
        }), { quantity: 0, amount: 0 });
    };

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // date ranges
    const getPastDate = (days) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
    };

    const last10DaysStart = getPastDate(10);
    const lastMonthStart = getPastDate(30);
    const last3MonthsStart = getPastDate(90);
    const lastYearStart = getPastDate(365);

    try {
        // Fetch all collections for this farmer (optimized: only needed columns)
        // For large datasets, this should be done via RPC or separate queries, 
        // but for < 10k records, client-side filtering is acceptable.
        // Better: use .gte('date', lastYearStart) to fetch only relevant data (max 1 year + extra for lifetime?? no lifetime needs all)

        // Strategy: 
        // 1. Fetch lifetime stats using .select('quantity, amount') for ALL records
        // 2. We can filter in JS for the ranges since we have the data. 
        // warning: if lifetime history is huge, this is heavy. 
        // Alternative: 4 parallel COUNT/SUM queries. Supabase doesn't support aggregate easily in SDK without RCP.
        // Let's fetch all. Assuming max 2-3 years data per farmer.

        const { data, error } = await supabase
            .from('collections')
            .select('date, quantity, amount')
            .eq('dairy_id', dairyId)
            .eq('farmer_id', farmerId);

        if (error) throw error;

        const stats = {
            last10Days: { quantity: 0, amount: 0 },
            lastMonth: { quantity: 0, amount: 0 },
            last3Months: { quantity: 0, amount: 0 },
            lastYear: { quantity: 0, amount: 0 },
            lifetime: { quantity: 0, amount: 0 }
        };

        if (!data || data.length === 0) return stats;

        // Lifetime
        stats.lifetime = calculateSum(data);

        // Filter for ranges
        const last10Recs = data.filter(r => r.date >= last10DaysStart && r.date <= today);
        stats.last10Days = calculateSum(last10Recs);

        const lastMonthRecs = data.filter(r => r.date >= lastMonthStart && r.date <= today);
        stats.lastMonth = calculateSum(lastMonthRecs);

        const last3MonthsRecs = data.filter(r => r.date >= last3MonthsStart && r.date <= today);
        stats.last3Months = calculateSum(last3MonthsRecs);

        const lastYearRecs = data.filter(r => r.date >= lastYearStart && r.date <= today);
        stats.lastYear = calculateSum(lastYearRecs);

        return stats;

    } catch (err) {
        console.error("Error fetching member stats:", err);
        return null;
    }
};

export const getLastFarmerEntry = async (farmerId, dairyId) => {


    const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('dairy_id', dairyId)
        .eq('farmer_id', farmerId)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
};



export const getRates = async (dairyId) => {
    const { data, error } = await supabase
        .from('rates')
        .select('*')
        .eq('dairy_id', dairyId)
        .order('milk_type', { ascending: true })
        .order('fat', { ascending: true })
        .order('snf', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const saveRates = async ({ rates, effectiveDate, dairy_id }) => {
    if (!dairy_id) throw new Error("dairy_id is required for saveRates");

    // Ensure all rates have dairy_id matching the param
    if (rates && Array.isArray(rates)) {
        rates.forEach(r => {
            if (r.dairy_id && r.dairy_id !== dairy_id) {
                throw new Error("Mismatched dairy_id in rates data");
            }
            // For convenience, we could also force it: r.dairy_id = dairy_id;
        });
    }

    const { error: deleteError } = await supabase
        .from('rates')
        .delete()
        .eq('dairy_id', dairy_id)
        .eq('effective_date', effectiveDate);

    if (deleteError) throw deleteError;

    if (rates.length > 0) {
        const { error: insertError } = await supabase
            .from('rates')
            .insert(rates);
        if (insertError) throw insertError;
    }
    return { success: true };
};

export const getRateForCollection = async ({ dairy_id, milk_type, fat, snf, date, rate_type = 'sangh' }) => {

    // Helper to find the best matching rate from a set of rows
    const findBestRate = (rows) => {
        if (!rows || rows.length === 0) return null;
        const exactMatch = rows.find(r =>
            parseFloat(r.fat) === parseFloat(fat) &&
            parseFloat(r.snf) === parseFloat(snf)
        );
        if (exactMatch) return parseFloat(exactMatch.rate);
        // Closest match fallback
        let closest = rows[0];
        let minDiff = 9999;
        for (const r of rows) {
            const diff = Math.abs(parseFloat(r.fat) - parseFloat(fat)) +
                Math.abs(parseFloat(r.snf) - parseFloat(snf));
            if (diff < minDiff) { minDiff = diff; closest = r; }
        }
        return parseFloat(closest.rate);
    };

    // Look up the most recent effective_date <= collection date for this rate_type
    const lookupRate = async (rType) => {
        let dateQuery = supabase
            .from('rates')
            .select('effective_date')
            .eq('dairy_id', dairy_id)
            .eq('milk_type', milk_type)
            .lte('effective_date', date)
            .order('effective_date', { ascending: false })
            .limit(1);

        if (rType === 'sangh') {
            dateQuery = dateQuery.or('rate_type.eq.sangh,rate_type.is.null');
        } else {
            dateQuery = dateQuery.eq('rate_type', rType);
        }

        const { data: dateData, error: dateError } = await dateQuery.maybeSingle();

        if (dateError || !dateData) return null;

        let rateQuery = supabase
            .from('rates')
            .select('*')
            .eq('dairy_id', dairy_id)
            .eq('milk_type', milk_type)
            .eq('effective_date', dateData.effective_date);

        if (rType === 'sangh') {
            rateQuery = rateQuery.or('rate_type.eq.sangh,rate_type.is.null');
        } else {
            rateQuery = rateQuery.eq('rate_type', rType);
        }

        const { data, error } = await rateQuery;

        if (error || !data || data.length === 0) return null;
        return findBestRate(data);
    };

    // Primary: use assigned rate_type
    const primaryRate = await lookupRate(rate_type);
    if (primaryRate !== null && primaryRate > 0) return { rate: primaryRate };

    // Fallback: sangh (only if the assigned type had no data)
    if (rate_type !== 'sangh') {
        const sanghRate = await lookupRate('sangh');
        if (sanghRate !== null && sanghRate > 0) return { rate: sanghRate };
    }

    return { rate: 0 };
};

export const getSellingRates = async (dairyId) => {
    const { data, error } = await supabase
        .from('selling_rates')
        .select('*')
        .eq('dairy_id', dairyId);
    if (error) throw error;
    return data || [];
};

export const saveSellingRates = async (rates) => {
    // Ensure all rates have dairy_id
    if (Array.isArray(rates)) {
        rates.forEach(r => {
            if (!r.dairy_id) throw new Error("dairy_id is required for selling rates");
        });
    } else if (rates && !rates.dairy_id) {
        throw new Error("dairy_id is required for selling rates");
    }

    const { error } = await supabase
        .from('selling_rates')
        .upsert(rates);
    if (error) throw error;
    return true;
};

export const getMilkSales = async (dairyId, referenceDate = null) => {
    // Load last 60 days relative to referenceDate (defaults to today).
    // Pass the dashboard's selected date so sales on a past date are never
    // cut off by the window when browsing historical data.
    const anchor = referenceDate ? new Date(referenceDate) : new Date();
    const sixtyDaysAgo = new Date(anchor);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const fromDate = sixtyDaysAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('milk_sales')
        .select('*')
        .eq('dairy_id', dairyId)
        .gte('sale_date', fromDate)
        .order('sale_date', { ascending: false })
        .limit(1000);

    if (error) throw error;
    return data || [];
};

export const getLastLocalSale = async (customerId, dairyId) => {
    const { data, error } = await supabase
        .from('milk_sales')
        .select('milk_type, quantity')
        .eq('dairy_id', dairyId)
        .eq('customer_id', customerId)
        .order('sale_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
};

export const addMilkSale = async (sale) => {
    if (!sale.dairy_id) throw new Error("dairy_id is required for milk sale");

    const { data, error } = await supabase
        .from('milk_sales')
        .insert([sale])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateMilkSale = async (sale, dairyId) => {
    // Strip immutable / filter-only fields from the UPDATE payload
    const { id, dairy_id, ...updatePayload } = sale;

    let query = supabase
        .from('milk_sales')
        .update(updatePayload)
        .eq('id', id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
};

export const deleteMilkSale = async (id, dairyId) => {
    let query = supabase
        .from('milk_sales')
        .delete()
        .eq('id', id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { error } = await query;
    if (error) throw error;
    return true;
};



export const getFederationReceipts = async (dairyId) => {
    const { data, error } = await supabase
        .from('federation_receipts')
        .select('*')
        .eq('dairy_id', dairyId)
        .order('receipt_date', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const addFederationReceipt = async (receipt) => {
    if (!receipt.dairy_id) throw new Error("dairy_id is required for federation receipt");

    const { data, error } = await supabase
        .from('federation_receipts')
        .insert([receipt])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateFederationReceipt = async (receipt, dairyId) => {
    let query = supabase
        .from('federation_receipts')
        .update(receipt)
        .eq('id', receipt.id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
};

export const deleteFederationReceipt = async (id, dairyId) => {
    let query = supabase
        .from('federation_receipts')
        .delete()
        .eq('id', id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { error } = await query;
    if (error) throw error;
    return true;
};




// Password functions removed â€” Supabase Auth handles authentication securely.
// If you need password reset, use: supabase.auth.resetPasswordForEmail(email)

export const getUsers = async (dairyId = null) => {
    let query = supabase
        .from('users')
        .select('*, dairies(name)');

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { data, error } = await query.order('id', { ascending: true });

    if (error) throw error;

    return (data || []).map(user => ({
        ...user,
        dairy_name: user.dairies?.name || null
    }));
};

export const addUser = async (user) => {
    if (!user.dairy_id && user.role !== 'super_admin') {
        throw new Error("dairy_id is required for non-super-admin users");
    }

    // Remove password completely to prevent schema errors
    const { password, ...userData } = user;

    const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();
    if (error) throw error;

    // Create proper auth account via Edge Function so employee can login
    if (data && data.username) {
        try {
            await supabase.functions.invoke('create-auth-user', {
                body: { type: 'employee', username: data.username, dairy_id: data.dairy_id, role: data.role }
            });
        } catch (authErr) {
            console.error('[API] Auth account creation failed (employee can be linked later):', authErr);
        }
    }

    return data;
};

export const updateUser = async (user, dairyId) => {
    const updates = { ...user };

    // Remove password completely to prevent schema errors
    delete updates.password;

    let query = supabase
        .from('users')
        .update(updates)
        .eq('id', updates.id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
};

export const deleteUser = async (id, dairyId) => {
    let query = supabase
        .from('users')
        .delete()
        .eq('id', id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { error } = await query;
    if (error) throw error;
    return true;
};



export const getDeductionMasters = async (dairyId) => {
    const { data, error } = await supabase
        .from('deduction_masters')
        .select('*')
        .eq('dairy_id', dairyId)
        .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const addDeductionMaster = async (master) => {
    // Ensure dairy_id is present for isolation
    if (!master.dairy_id) throw new Error("dairy_id is required for deduction master");

    const { data, error } = await supabase
        .from('deduction_masters')
        .insert([master])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateDeductionMaster = async (master, dairyId) => {
    let query = supabase
        .from('deduction_masters')
        .update(master)
        .eq('id', master.id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
};

export const deleteDeductionMaster = async (id, dairyId) => {
    let query = supabase
        .from('deduction_masters')
        .delete()
        .eq('id', id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { error } = await query;
    if (error) throw error;
    return true;
};

export const getFarmerDeductions = async (dairyId) => {
    const { data, error } = await supabase
        .from('farmer_deductions')
        .select('*, deduction_masters(name, type), farmers(name, code)')
        .eq('dairy_id', dairyId)
        .order('id', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
        ...d,
        farmer_name: d.farmers?.name,
        farmer_code: d.farmers?.code,
        deduction_name: d.deduction_masters?.name,
        // Always resolve type from the master join — covers migrated rows that
        // may have a null deduction_type column in farmer_deductions
        deduction_type: d.deduction_type || d.deduction_masters?.type,
    }));
};

export const assignDeduction = async (deduction) => {
    if (!deduction.dairy_id) throw new Error("dairy_id is required for deduction assignment");

    const { data, error } = await supabase
        .from('farmer_deductions')
        .insert([deduction])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteFarmerDeduction = async (id, dairyId) => {
    let query = supabase
        .from('farmer_deductions')
        .delete()
        .eq('id', id);

    if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);

    const { error } = await query;
    if (error) throw error;
    return true;
};

// Remove a deduction entry from all bill_payments history records
export const removeDeductionFromHistory = async (deductionId, dairyId) => {
    try {
        // Get all bill_payments that might contain this deduction
        let query = supabase
            .from('bill_payments')
            .select('id, deductions_summary');
        if (!dairyId) throw new Error('[Security] dairyId is required for this operation');
    query = query.eq('dairy_id', dairyId);
        
        const { data: payments, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        for (const payment of (payments || [])) {
            if (!payment.deductions_summary) continue;
            let deductions = [];
            try {
                deductions = JSON.parse(payment.deductions_summary);
            } catch (e) { continue; }

            const filtered = deductions.filter(d => String(d.id) !== String(deductionId));
            if (filtered.length !== deductions.length) {
                // This payment had the deduction - update it
                const { error: updateError } = await supabase
                    .from('bill_payments')
                    .update({ deductions_summary: JSON.stringify(filtered) })
                    .eq('id', payment.id);
                if (updateError) console.error('Error updating bill_payment:', updateError);
            }
        }
    } catch (error) {
        console.error('Error removing deduction from history:', error);
    }
};



export const getBillPayments = async ({ startDate, endDate, dairy_id, farmerId = null }) => {
    let query = supabase
        .from('bill_payments')
        .select('*')
        .eq('dairy_id', dairy_id);

    if (startDate) query = query.gte('start_date', startDate);
    if (endDate) query = query.lte('end_date', endDate);
    if (farmerId) query = query.eq('farmer_id', farmerId);

    const { data, error } = await query.order('payment_date', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getFarmerDeductionLogs = async (farmerId, dairyId) => {
    const { data, error } = await supabase
        .from('farmer_deduction_logs')
        .select('*')
        .eq('farmer_id', farmerId)
        .eq('dairy_id', dairyId)
        .order('payment_date', { ascending: false });

    if (error) {
        console.error('Error fetching farmer deduction logs:', error);
        return [];
    }
    return data || [];
};

export const processBillPayment = async (paymentData) => {
    // Call the atomic RPC to insert payment AND update deduction balances
    const { data, error } = await supabase.rpc('process_bill_payment_v2', {
        p_farmer_id: paymentData.farmerId,
        p_dairy_id: paymentData.dairy_id,
        p_start_date: paymentData.startDate,
        p_end_date: paymentData.endDate,
        p_amount: paymentData.amount,
        p_deductions_summary: paymentData.deductions || [],
        p_deduction_list: paymentData.deductionList || [] 
    });

    if (error) throw error;

    return data;
};

export const revertBillPayment = async ({ id, deductions, dairy_id }) => {
    if (deductions && deductions.length > 0) {
        for (const d of deductions) {
            const { data: currentDed } = await supabase
                .from('farmer_deductions')
                .select('collected_amount')
                .eq('id', d.id)
                .single();

            if (currentDed) {
                const newCollected = Math.max(0, (parseFloat(currentDed.collected_amount) || 0) - parseFloat(d.amount));
                let dedQuery = supabase
                    .from('farmer_deductions')
                    .update({ collected_amount: newCollected })
                    .eq('id', d.id);
                if (dairy_id) dedQuery = dedQuery.eq('dairy_id', dairy_id);
                await dedQuery;
            }
        }
    }

    const { error } = await supabase
        .from('bill_payments')
        .delete()
        .eq('id', id)
        .eq('dairy_id', dairy_id);
    if (error) throw error;
    return true;
};



// ─── ठेव व्यवस्थापन (Thev Management) API ─────────────────────────────────

export const getThevMasters = async (dairyId) => {
    const { data, error } = await supabase
        .from('thev_masters')
        .select('*')
        .eq('dairy_id', dairyId)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const saveThevMaster = async (master) => {
    if (!master.dairy_id) throw new Error('dairy_id is required for thev master');
    const { id, ...rest } = master;
    if (id) {
        // UPDATE existing — do NOT use .select().single() after update because
        // some RLS configs block the read-back even when UPDATE succeeds, causing a false error.
        const { error } = await supabase
            .from('thev_masters')
            .update(rest)
            .eq('id', id)
            .eq('dairy_id', rest.dairy_id);
        if (error) throw error;
        return { id, ...rest };
    } else {
        // INSERT new — never send id, let DB auto-generate via sequence
        const { data, error } = await supabase
            .from('thev_masters')
            .insert([rest])
            .select().single();
        if (error) throw error;
        return data;
    }
};

/**
 * Recalculate all Thev deposits from a given date onwards for all farmers
 * who are assigned to a specific Thev master scheme.
 * Called when the admin changes the rate and wants past entries re-calculated.
 */
export const recalcThevFromDate = async ({ dairyId, masterId, fromDate, newRate, deductionType }) => {
    if (!dairyId || !masterId || !fromDate || !newRate) throw new Error('Missing required parameters');

    // Step 1: Get all farmer accounts linked to this master scheme
    const { data: accounts, error: accErr } = await supabase
        .from('farmer_thev_accounts')
        .select('id, farmer_id, status')
        .eq('dairy_id', dairyId)
        .eq('thev_master_id', masterId);
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) return { updated: 0 };

    let totalUpdated = 0;

    for (const acc of accounts) {
        // Step 2: Delete all deposit transactions from fromDate onwards for this account
        await supabase
            .from('thev_transactions')
            .delete()
            .eq('thev_account_id', acc.id)
            .eq('dairy_id', dairyId)
            .eq('transaction_type', 'deposit')
            .gte('transaction_date', fromDate);

        // Step 3: Fetch all collections from fromDate onwards for this farmer
        const { data: collections, error: colErr } = await supabase
            .from('collections')
            .select('id, date, quantity, amount')
            .eq('dairy_id', dairyId)
            .eq('farmer_id', acc.farmer_id)
            .gte('date', fromDate)
            .order('date', { ascending: true });
        if (colErr) continue;
        if (!collections || collections.length === 0) {
            // No collections in this period — just recalculate balance
        } else {
            // Step 4: Re-insert Thev deposits with new rate
            const txnsToInsert = [];
            for (const col of collections) {
                let depositAmt = 0;
                if (deductionType === 'per_liter') {
                    depositAmt = parseFloat(newRate) * parseFloat(col.quantity || 0);
                } else if (deductionType === 'fixed_amount') {
                    depositAmt = parseFloat(newRate);
                } else if (deductionType === 'percentage') {
                    depositAmt = (parseFloat(newRate) / 100) * parseFloat(col.amount || 0);
                }
                if (depositAmt > 0) {
                    txnsToInsert.push({
                        dairy_id: dairyId,
                        farmer_id: acc.farmer_id,
                        thev_account_id: acc.id,
                        transaction_type: 'deposit',
                        amount: parseFloat(depositAmt.toFixed(2)),
                        interest_amount: 0,
                        balance_after: 0,
                        remarks: deductionType === 'per_liter'
                                ? `${col.quantity} लिटर × ₹${newRate}/L = ₹${parseFloat(depositAmt.toFixed(2))} ठेव जमा (दर बदल)`
                                : deductionType === 'percentage'
                                ? `${col.quantity} लिटर दुधावर ${newRate}% = ₹${parseFloat(depositAmt.toFixed(2))} ठेव जमा (दर बदल)`
                                : `${col.quantity} लिटर दुधावर ₹${parseFloat(depositAmt.toFixed(2))} ठेव जमा (दर बदल)`,
                        transaction_date: col.date,
                        reference_collection_id: col.id
                    });
                }
            }
            if (txnsToInsert.length > 0) {
                await supabase.from('thev_transactions').insert(txnsToInsert);
            }
        }

        // Step 5: Recalculate account balance AND update balance_after on every row
        const { data: allTxnsFull } = await supabase
            .from('thev_transactions')
            .select('id, transaction_type, amount')
            .eq('thev_account_id', acc.id)
            .eq('dairy_id', dairyId)
            .order('transaction_date', { ascending: true })
            .order('id', { ascending: true });

        if (allTxnsFull) {
            let running = 0;
            for (const t of allTxnsFull) {
                const amt = parseFloat(t.amount || 0);
                if (['deposit', 'opening', 'interest'].includes(t.transaction_type)) running += amt;
                else if (t.transaction_type === 'refund') running -= amt;
                running = Math.max(0, running);
                await supabase.from('thev_transactions').update({ balance_after: parseFloat(running.toFixed(2)) }).eq('id', t.id).eq('dairy_id', dairyId);
            }
            const totalDeposited = allTxnsFull.filter(t => ['deposit', 'opening'].includes(t.transaction_type)).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            const totalRefunded  = allTxnsFull.filter(t => t.transaction_type === 'refund').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            await supabase.from('farmer_thev_accounts')
                .update({ current_balance: parseFloat(running.toFixed(2)), total_deposited: parseFloat(totalDeposited.toFixed(2)), total_refunded: parseFloat(totalRefunded.toFixed(2)) })
                .eq('id', acc.id).eq('dairy_id', dairyId);
        }

        totalUpdated++;
    }

    return { updated: totalUpdated };
};

export const deleteThevMaster = async (id, dairyId) => {
    if (!dairyId) throw new Error('[Security] dairyId is required');
    const { error } = await supabase
        .from('thev_masters')
        .delete()
        .eq('id', id)
        .eq('dairy_id', dairyId);
    if (error) throw error;
    return true;
};

export const getFarmerThevAccounts = async (dairyId) => {
    // Fetch accounts without joins (FK relationships may not be registered in PostgREST)
    const { data: accounts, error } = await supabase
        .from('farmer_thev_accounts')
        .select('*')
        .eq('dairy_id', dairyId)
        .order('id', { ascending: false });
    if (error) throw error;
    if (!accounts || accounts.length === 0) return [];

    // Fetch related masters and farmers in parallel
    const masterIds = [...new Set(accounts.map(a => a.thev_master_id).filter(Boolean))];
    const farmerIds = [...new Set(accounts.map(a => a.farmer_id).filter(Boolean))];

    const [mastersRes, farmersRes] = await Promise.all([
        masterIds.length > 0
            ? supabase.from('thev_masters').select('id, name, deduction_type, default_rate').in('id', masterIds)
            : { data: [] },
        farmerIds.length > 0
            ? supabase.from('farmers').select('id, name, code').in('id', farmerIds)
            : { data: [] },
    ]);

    const mastersMap = Object.fromEntries((mastersRes.data || []).map(m => [m.id, m]));
    const farmersMap = Object.fromEntries((farmersRes.data || []).map(f => [f.id, f]));

    return accounts.map(a => ({
        ...a,
        farmer_name: farmersMap[a.farmer_id]?.name || '',
        farmer_code: farmersMap[a.farmer_id]?.code || '',
        thev_name: mastersMap[a.thev_master_id]?.name || '',
        thev_type: mastersMap[a.thev_master_id]?.deduction_type || '',
    }));
};

/**
 * computeThevFromCollections — core helper for the compute-from-collections architecture.
 *
 * Instead of relying on thev_transactions deposit rows (which are no longer written at
 * milk-entry time), this function derives Thev deposit amounts directly from the
 * collections table by multiplying each entry's quantity/amount by the account's rate.
 *
 * @param {string} dairyId
 * @param {string|null} upToDate  - ISO date string (inclusive). null = all time.
 * @returns {Object} map: { [thev_account_id]: { deposited, farmerId } }
 */
const computeThevFromCollections = async (dairyId, upToDate = null) => {
    // Fetch all active Thev accounts with their rate and deduction_type
    const { data: accounts, error: accErr } = await supabase
        .from('farmer_thev_accounts')
        .select('id, farmer_id, rate, start_date, thev_master_id')
        .eq('dairy_id', dairyId);
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) return {};

    // Fetch deduction_type from thev_masters for all unique master IDs
    const masterIds = [...new Set(accounts.map(a => a.thev_master_id).filter(Boolean))];
    const mastersRes = masterIds.length > 0
        ? await supabase.from('thev_masters').select('id, deduction_type').in('id', masterIds)
        : { data: [] };
    const mastersMap = Object.fromEntries((mastersRes.data || []).map(m => [String(m.id), m.deduction_type]));

    // Map farmer_id → list of active accounts (a farmer may have multiple Thev accounts)
    const byFarmer = {}; // { farmerId: [{ accountId, rate, deductionType, startDate }] }
    for (const acc of accounts) {
        const deductionType = mastersMap[String(acc.thev_master_id)] || '';
        if (!deductionType) continue; // Skip accounts without a known type
        const fid = String(acc.farmer_id);
        if (!byFarmer[fid]) byFarmer[fid] = [];
        byFarmer[fid].push({
            accountId: String(acc.id),
            rate: parseFloat(acc.rate || 0),
            deductionType,
            startDate: acc.start_date || '2000-01-01',
        });
    }

    const farmerIds = Object.keys(byFarmer);
    if (farmerIds.length === 0) return {};

    // Fetch all relevant collections in ONE query
    let colQuery = supabase
        .from('collections')
        .select('farmer_id, quantity, amount, date')
        .eq('dairy_id', dairyId)
        .in('farmer_id', farmerIds);
    if (upToDate) colQuery = colQuery.lte('date', upToDate);
    const { data: cols, error: colErr } = await colQuery;
    if (colErr) throw colErr;

    // Compute deposit totals per account
    const totalsMap = {}; // { accountId: { deposited, farmerId } }
    for (const col of (cols || [])) {
        const fid = String(col.farmer_id);
        const accs = byFarmer[fid];
        if (!accs) continue;
        for (const acc of accs) {
            // Only count collections that are on or after the account's start date
            if (col.date < acc.startDate) continue;
            let depositAmt = 0;
            if (acc.deductionType === 'per_liter') {
                depositAmt = acc.rate * parseFloat(col.quantity || 0);
            } else if (acc.deductionType === 'fixed_amount') {
                depositAmt = acc.rate;
            } else if (acc.deductionType === 'percentage') {
                depositAmt = (acc.rate / 100) * parseFloat(col.amount || 0);
            }
            if (!totalsMap[acc.accountId]) totalsMap[acc.accountId] = { deposited: 0, farmerId: fid };
            totalsMap[acc.accountId].deposited += depositAmt;
        }
    }

    return totalsMap;
};

/**
 * repairAllThevBalances — recomputes current_balance from collections + manual transactions.
 *
 * NEW ARCHITECTURE: Milk-entry auto-deposit rows are no longer written to thev_transactions.
 * Deposit amounts are computed on-the-fly from the collections table.
 * Manual entries (opening, interest, refund) still live in thev_transactions.
 *
 * Strategy (3 DB reads + 1 batch write):
 *   1. computeThevFromCollections — derives deposit total from collections × rate
 *   2. Fetch manual thev_transactions (opening, interest, refund)
 *   3. Combine: balance = computed_deposits + manual_opening + manual_interest - refunds
 *   4. Update only accounts whose stored balance differs from computed
 *
 * Returns { repaired: N } — N is 0 if all balances were already correct.
 */
export const repairAllThevBalances = async (dairyId) => {
    if (!dairyId) return { repaired: 0 };

    // Step 1: Compute deposits from collections
    const depositTotals = await computeThevFromCollections(dairyId);

    // Step 2: Fetch all farmer_thev_accounts
    const { data: accounts, error: accErr } = await supabase
        .from('farmer_thev_accounts')
        .select('id, current_balance, total_deposited, total_refunded')
        .eq('dairy_id', dairyId);
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) return { repaired: 0 };

    // Step 3: Fetch manual transactions only (opening, interest, refund — NOT deposit)
    const { data: manualTxns, error: txnErr } = await supabase
        .from('thev_transactions')
        .select('thev_account_id, transaction_type, amount')
        .eq('dairy_id', dairyId)
        .in('transaction_type', ['opening', 'interest', 'refund']);
    if (txnErr) throw txnErr;

    // Group manual transactions by account
    const manualMap = {}; // { accountId: { opening, interest, refunded } }
    for (const t of (manualTxns || [])) {
        const id = String(t.thev_account_id);
        if (!manualMap[id]) manualMap[id] = { opening: 0, interest: 0, refunded: 0 };
        const amt = parseFloat(t.amount || 0);
        if (t.transaction_type === 'opening')  manualMap[id].opening  += amt;
        if (t.transaction_type === 'interest') manualMap[id].interest += amt;
        if (t.transaction_type === 'refund')   manualMap[id].refunded += amt;
    }

    // Step 4: Compute correct totals and update stale accounts
    let repaired = 0;
    const updatePromises = [];
    for (const acc of accounts) {
        const id = String(acc.id);
        const colDeposits = depositTotals[id]?.deposited || 0;
        const manual = manualMap[id] || { opening: 0, interest: 0, refunded: 0 };
        const totalDeposited = colDeposits + manual.opening + manual.interest;
        const totalRefunded  = manual.refunded;
        const computedBalance   = parseFloat(Math.max(0, totalDeposited - totalRefunded).toFixed(2));
        const computedDeposited = parseFloat(totalDeposited.toFixed(2));
        const computedRefunded  = parseFloat(totalRefunded.toFixed(2));
        const storedBalance = parseFloat(parseFloat(acc.current_balance || 0).toFixed(2));

        if (Math.abs(computedBalance - storedBalance) >= 0.01) {
            repaired++;
            updatePromises.push(
                supabase
                    .from('farmer_thev_accounts')
                    .update({
                        current_balance: computedBalance,
                        total_deposited: computedDeposited,
                        total_refunded:  computedRefunded,
                    })
                    .eq('id', acc.id)
                    .eq('dairy_id', dairyId)
            );
        }
    }

    if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
    }

    return { repaired };
};


export const assignFarmerThev = async (account) => {
    if (!account.dairy_id) throw new Error('dairy_id is required');
    if (!account.farmer_id) throw new Error('farmer_id is required');
    if (!account.thev_master_id) throw new Error('thev_master_id is required');
    // Strip id and deduction_type (not a DB column — only used for backfill calculation)
    const { id, deduction_type, ...insertData } = account;
    const { data, error } = await supabase
        .from('farmer_thev_accounts')
        .insert([insertData])
        .select().single();
    if (error) throw error;


    const today = new Date().toISOString().split('T')[0];
    const startDate = account.start_date || today;
    let runningBalance = parseFloat(account.opening_balance) || 0;

    // If opening_balance > 0, record as opening transaction using the account's start_date
    if (runningBalance > 0) {
        const { error: txnErr } = await supabase.from('thev_transactions').insert([{
            dairy_id: account.dairy_id,
            farmer_id: account.farmer_id,
            thev_account_id: data.id,
            transaction_type: 'opening',
            amount: runningBalance,
            interest_amount: 0,
            balance_after: runningBalance,
            remarks: 'आरंभिक शिल्लक',
            transaction_date: startDate
        }]);
        if (txnErr) throw txnErr;
    }

    // ── Backfill: auto-deposit for ALL existing collections since start_date ──
    // Includes today's existing collections (future saves handled by auto-deposit)
    if (startDate <= today) {
        try {
            // Fetch all past collections for this farmer from start_date to yesterday
            const { data: pastCollections, error: colErr } = await supabase
                .from('collections')
                .select('id, date, quantity, amount')
                .eq('dairy_id', account.dairy_id)
                .eq('farmer_id', account.farmer_id)
                .gte('date', startDate)
                .lte('date', today)    // Include today's already-saved collections
                .order('date', { ascending: true });

            if (!colErr && pastCollections && pastCollections.length > 0) {
                const thevType  = account.deduction_type || 'per_liter';
                const rate      = parseFloat(account.rate) || 0;
                const txnsToInsert = [];

                for (const col of pastCollections) {
                    let depositAmt = 0;
                    if (thevType === 'per_liter') {
                        depositAmt = rate * parseFloat(col.quantity || 0);
                    } else if (thevType === 'fixed_amount') {
                        depositAmt = rate;
                    } else if (thevType === 'percentage') {
                        depositAmt = (rate / 100) * parseFloat(col.amount || 0);
                    }
                    if (depositAmt > 0) {
                        runningBalance += depositAmt;
                        txnsToInsert.push({
                            dairy_id:         account.dairy_id,
                            farmer_id:        account.farmer_id,
                            thev_account_id:  data.id,
                            transaction_type: 'deposit',
                            amount:           parseFloat(depositAmt.toFixed(2)),
                            interest_amount:  0,
                            balance_after:    parseFloat(runningBalance.toFixed(2)),
                            remarks:          thevType === 'per_liter'
                                ? `${col.quantity} लिटर × ₹${rate}/L = ₹${parseFloat(depositAmt.toFixed(2))} (मागील)`
                                : `${col.quantity} लिटर दुधावर ठेव जमा (मागील)`,
                            transaction_date: col.date
                        });
                    }
                }

                if (txnsToInsert.length > 0) {
                    // Insert all backfill transactions (throw on error so balance is not mis-updated)
                    const { error: insertErr } = await supabase.from('thev_transactions').insert(txnsToInsert);
                    if (insertErr) throw new Error('ठेव व्यवहार जोडणे अयशस्वी: ' + insertErr.message);
                    // Update account balance with backfilled total
                    await supabase
                        .from('farmer_thev_accounts')
                        .update({
                            current_balance:  parseFloat(runningBalance.toFixed(2)),
                            total_deposited:  parseFloat(runningBalance.toFixed(2))
                        })
                        .eq('id', data.id)
                        .eq('dairy_id', account.dairy_id);
                }
            }
        } catch (backfillErr) {
            // Surface error so user can see what went wrong
            throw new Error('खाते तयार झाले पण मागील नोंदी जोडणे अयशस्वी: ' + (backfillErr.message || backfillErr));
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return data;
};



export const updateFarmerThevAccount = async (id, updates, dairyId) => {
    if (!dairyId) throw new Error('[Security] dairyId is required');
    const { data, error } = await supabase
        .from('farmer_thev_accounts')
        .update(updates)
        .eq('id', id)
        .eq('dairy_id', dairyId)
        .select().single();
    if (error) throw error;
    return data;
};

export const deleteFarmerThevAccount = async (id, dairyId) => {
    if (!dairyId) throw new Error('[Security] dairyId is required');
    const { error } = await supabase
        .from('farmer_thev_accounts')
        .delete()
        .eq('id', id)
        .eq('dairy_id', dairyId);
    if (error) throw error;
    return true;
};

// ─── Re-backfill an existing Thev account (repair tool for broken/null-dated transactions) ──
// Deletes all deposit transactions for the account and re-inserts them using correct collection dates.
export const rebackfillThevAccount = async ({ dairyId, accountId, farmerId, rate, deductionType, startDate }) => {
    if (!dairyId || !accountId || !farmerId) throw new Error('dairyId, accountId, farmerId are required');
    const today = new Date().toISOString().split('T')[0];
    const from  = startDate || '2000-01-01';

    // Step 1: Delete ALL existing deposit transactions (including null-dated broken ones)
    await supabase
        .from('thev_transactions')
        .delete()
        .eq('thev_account_id', accountId)
        .eq('dairy_id', dairyId)
        .eq('transaction_type', 'deposit');

    // Step 2: Fetch all collections using CORRECT column name
    const { data: collections, error: colErr } = await supabase
        .from('collections')
        .select('id, date, quantity, amount')
        .eq('dairy_id', dairyId)
        .eq('farmer_id', farmerId)
        .gte('date', from)
        .lte('date', today)
        .order('date', { ascending: true });
    if (colErr) throw colErr;

    // Step 3: Account for existing opening / interest / refund to compute running balance
    const { data: nonDepositTxns } = await supabase
        .from('thev_transactions')
        .select('transaction_type, amount')
        .eq('thev_account_id', accountId)
        .eq('dairy_id', dairyId);
    let runningBalance = (nonDepositTxns || []).reduce((sum, t) => {
        if (['opening', 'interest'].includes(t.transaction_type)) return sum + parseFloat(t.amount || 0);
        if (t.transaction_type === 'refund') return sum - parseFloat(t.amount || 0);
        return sum;
    }, 0);
    runningBalance = Math.max(0, runningBalance);

    // Step 4: Build and insert new deposit transactions
    const txnsToInsert = [];
    for (const col of (collections || [])) {
        let depositAmt = 0;
        if (deductionType === 'per_liter') {
            depositAmt = parseFloat(rate) * parseFloat(col.quantity || 0);
        } else if (deductionType === 'fixed_amount') {
            depositAmt = parseFloat(rate);
        } else if (deductionType === 'percentage') {
            depositAmt = (parseFloat(rate) / 100) * parseFloat(col.amount || 0);
        }
        if (depositAmt > 0) {
            runningBalance += depositAmt;
            txnsToInsert.push({
                dairy_id:              dairyId,
                farmer_id:            farmerId,
                thev_account_id:      accountId,
                transaction_type:     'deposit',
                amount:               parseFloat(depositAmt.toFixed(2)),
                interest_amount:      0,
                balance_after:        parseFloat(runningBalance.toFixed(2)),
                remarks:              deductionType === 'per_liter'
                    ? `${col.quantity} लिटर × ₹${rate}/L = ₹${parseFloat(depositAmt.toFixed(2))} (मागील)`
                    : `${col.quantity} लिटर दुधावर ठेव जमा (मागील)`,
                transaction_date:     col.date,
                reference_collection_id: col.id || null,
            });
        }
    }

    // Insert in chunks of 200 to avoid Supabase statement timeout for large histories
    if (txnsToInsert.length > 0) {
        const CHUNK_SIZE = 200;
        for (let i = 0; i < txnsToInsert.length; i += CHUNK_SIZE) {
            const chunk = txnsToInsert.slice(i, i + CHUNK_SIZE);
            const { error: insErr } = await supabase.from('thev_transactions').insert(chunk);
            if (insErr) throw insErr;
            // Small pause between chunks to avoid overwhelming the connection
            if (i + CHUNK_SIZE < txnsToInsert.length) {
                await new Promise(r => setTimeout(r, 150));
            }
        }
    }

    // Step 5: Recalculate account totals from all remaining transactions
    const { data: allTxns } = await supabase
        .from('thev_transactions')
        .select('transaction_type, amount')
        .eq('thev_account_id', accountId)
        .eq('dairy_id', dairyId);
    const totalDeposited = (allTxns || [])
        .filter(t => ['deposit', 'opening'].includes(t.transaction_type))
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const totalRefunded = (allTxns || [])
        .filter(t => t.transaction_type === 'refund')
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const currentBalance = Math.max(0, totalDeposited - totalRefunded);
    await supabase
        .from('farmer_thev_accounts')
        .update({
            current_balance: parseFloat(currentBalance.toFixed(2)),
            total_deposited: parseFloat(totalDeposited.toFixed(2)),
            total_refunded:  parseFloat(totalRefunded.toFixed(2)),
        })
        .eq('id', accountId)
        .eq('dairy_id', dairyId);

    return { inserted: txnsToInsert.length, totalDeposited, currentBalance };
};

export const getFarmerThevLedger = async (farmerId, dairyId, startDate, endDate) => {
    // ── NEW ARCHITECTURE: deposits computed from collections, not thev_transactions ──
    // Manual entries (opening, interest, refund) still come from thev_transactions.
    // Deposit rows are synthesised from collections × rate — always live and accurate.

    // 1. Fetch this farmer's Thev accounts with deduction_type from masters
    const { data: accounts, error: accErr } = await supabase
        .from('farmer_thev_accounts')
        .select('id, rate, start_date, thev_master_id')
        .eq('dairy_id', dairyId)
        .eq('farmer_id', farmerId);
    if (accErr) throw accErr;

    let depositRows = [];

    if (accounts && accounts.length > 0) {
        // Fetch deduction_type from thev_masters
        const masterIds = [...new Set(accounts.map(a => a.thev_master_id).filter(Boolean))];
        const mastersRes = masterIds.length > 0
            ? await supabase.from('thev_masters').select('id, deduction_type, name').in('id', masterIds)
            : { data: [] };
        const mastersMap = Object.fromEntries((mastersRes.data || []).map(m => [String(m.id), m]));

        // 2. Fetch collections for this farmer in the date range
        let colQuery = supabase
            .from('collections')
            .select('id, quantity, amount, date, shift')
            .eq('dairy_id', dairyId)
            .eq('farmer_id', farmerId);
        if (startDate) colQuery = colQuery.gte('date', startDate);
        if (endDate)   colQuery = colQuery.lte('date', endDate);
        const { data: cols, error: colErr } = await colQuery.order('date', { ascending: true });
        if (colErr) throw colErr;

        // 3. For each collection × each account: build a synthetic deposit row
        for (const col of (cols || [])) {
            for (const acc of accounts) {
                const master = mastersMap[String(acc.thev_master_id)];
                if (!master) continue;
                const deductionType = master.deduction_type || '';
                const accStartDate = acc.start_date || '2000-01-01';
                if (col.date < accStartDate) continue;

                const rate = parseFloat(acc.rate || 0);
                let depositAmt = 0;
                let remarks = 'ठेव जमा';

                if (deductionType === 'per_liter') {
                    depositAmt = rate * parseFloat(col.quantity || 0);
                    remarks = `${col.quantity} लिटर × ₹${rate}/L = ₹${parseFloat(depositAmt.toFixed(2))} ठेव जमा`;
                } else if (deductionType === 'fixed_amount') {
                    depositAmt = rate;
                    remarks = `₹${rate} ठेव जमा (प्रति संकलन)`;
                } else if (deductionType === 'percentage') {
                    depositAmt = (rate / 100) * parseFloat(col.amount || 0);
                    remarks = `${col.quantity} लिटर × ${rate}% = ₹${parseFloat(depositAmt.toFixed(2))} ठेव जमा`;
                }

                if (depositAmt <= 0) continue;

                depositRows.push({
                    id: `col_${col.id}_acc_${acc.id}`, // synthetic ID (not in DB)
                    dairy_id: dairyId,
                    farmer_id: farmerId,
                    thev_account_id: acc.id,
                    transaction_type: 'deposit',
                    amount: parseFloat(depositAmt.toFixed(2)),
                    interest_amount: 0,
                    balance_after: 0, // computed below after sorting
                    remarks,
                    transaction_date: col.date,
                    reference_collection_id: col.id,
                    _synthetic: true, // flag: this row is computed, not from DB
                });
            }
        }
    }

    // 4. Fetch manual transactions (opening, interest, refund) from thev_transactions
    let manualQuery = supabase
        .from('thev_transactions')
        .select('*')
        .eq('dairy_id', dairyId)
        .in('transaction_type', ['opening', 'interest', 'refund']);
    if (farmerId) manualQuery = manualQuery.eq('farmer_id', farmerId);
    if (startDate) manualQuery = manualQuery.gte('transaction_date', startDate);
    if (endDate)   manualQuery = manualQuery.lte('transaction_date', endDate);
    const { data: manualTxns, error: manErr } = await manualQuery;
    if (manErr) throw manErr;

    // 5. Merge and sort by date then id
    const all = [
        ...(manualTxns || []),
        ...depositRows,
    ].sort((a, b) => {
        const dateA = a.transaction_date || '';
        const dateB = b.transaction_date || '';
        if (dateA !== dateB) return dateA < dateB ? -1 : 1;
        // For same date: deposits before manual entries (opening/interest/refund)
        return 0;
    });

    // 6. Compute running balance_after for display
    let running = 0;
    for (const row of all) {
        const amt = parseFloat(row.amount || 0);
        if (['deposit', 'opening', 'interest'].includes(row.transaction_type)) running += amt;
        else if (row.transaction_type === 'refund') running -= amt;
        running = Math.max(0, running);
        row.balance_after = parseFloat(running.toFixed(2));
    }

    return all;
};


/**
 * Compute Thev DEPOSIT amounts for a dairy in a date range, from collections.
 * NEW ARCHITECTURE: Auto-deposit rows are no longer in thev_transactions.
 * Amounts are computed from collections × rate for the billing period.
 * Returns a map: { [farmer_id]: { [thev_account_id]: totalDepositAmount } }
 */
export const getThevTransactionsForBilling = async (dairyId, startDate, endDate) => {
    // Fetch all active accounts with rates
    const { data: accounts, error: accErr } = await supabase
        .from('farmer_thev_accounts')
        .select('id, farmer_id, rate, start_date, thev_master_id')
        .eq('dairy_id', dairyId);
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) return {};

    // Get deduction_type from masters
    const masterIds = [...new Set(accounts.map(a => a.thev_master_id).filter(Boolean))];
    const mastersRes = masterIds.length > 0
        ? await supabase.from('thev_masters').select('id, deduction_type').in('id', masterIds)
        : { data: [] };
    const mastersMap = Object.fromEntries((mastersRes.data || []).map(m => [String(m.id), m.deduction_type]));

    const byFarmer = {};
    for (const acc of accounts) {
        const deductionType = mastersMap[String(acc.thev_master_id)] || '';
        if (!deductionType) continue;
        const fid = String(acc.farmer_id);
        if (!byFarmer[fid]) byFarmer[fid] = [];
        byFarmer[fid].push({ accountId: String(acc.id), rate: parseFloat(acc.rate || 0), deductionType, startDate: acc.start_date || '2000-01-01' });
    }

    const farmerIds = Object.keys(byFarmer);
    if (farmerIds.length === 0) return {};

    // Fetch collections within billing period
    let colQuery = supabase
        .from('collections')
        .select('farmer_id, quantity, amount, date')
        .eq('dairy_id', dairyId)
        .in('farmer_id', farmerIds);
    if (startDate) colQuery = colQuery.gte('date', startDate);
    if (endDate)   colQuery = colQuery.lte('date', endDate);
    const { data: cols, error: colErr } = await colQuery;
    if (colErr) throw colErr;

    // Compute deposit map: farmer_id -> account_id -> total
    const map = {};
    for (const col of (cols || [])) {
        const fid = String(col.farmer_id);
        const accs = byFarmer[fid];
        if (!accs) continue;
        for (const acc of accs) {
            if (col.date < acc.startDate) continue;
            let depositAmt = 0;
            if (acc.deductionType === 'per_liter')    depositAmt = acc.rate * parseFloat(col.quantity || 0);
            else if (acc.deductionType === 'fixed_amount') depositAmt = acc.rate;
            else if (acc.deductionType === 'percentage')   depositAmt = (acc.rate / 100) * parseFloat(col.amount || 0);
            if (!map[fid]) map[fid] = {};
            if (!map[fid][acc.accountId]) map[fid][acc.accountId] = 0;
            map[fid][acc.accountId] += depositAmt;
        }
    }
    return map;
};

// Compute each thev account's balance AS OF a specific date (not today's live balance).
// NEW ARCHITECTURE: Deposits computed from collections; manual entries from thev_transactions.
// Used by billing to show historically-accurate ठेव शिल्लक on old bills.
export const getThevBalancesUpToDate = async (dairyId, upToDate) => {
    // 1. Compute collection-derived deposits up to the billing period end
    const depositTotals = await computeThevFromCollections(dairyId, upToDate);

    // 2. Fetch manual transactions (opening, interest, refund) — all time, for all accounts
    const { data: manualTxns, error } = await supabase
        .from('thev_transactions')
        .select('farmer_id, thev_account_id, transaction_type, amount, transaction_date')
        .eq('dairy_id', dairyId)
        .in('transaction_type', ['opening', 'interest', 'refund']);
    if (error) throw error;

    // Group manual entries: { farmerId: { accountId: { opening, interest, refunded } } }
    const manualMap = {};
    for (const txn of (manualTxns || [])) {
        const fid = String(txn.farmer_id);
        const aid = String(txn.thev_account_id);
        if (!manualMap[fid]) manualMap[fid] = {};
        if (!manualMap[fid][aid]) manualMap[fid][aid] = 0;
        const amt = parseFloat(txn.amount || 0);
        const type = txn.transaction_type;
        // opening and interest: only count up to billing period end
        if ((type === 'opening' || type === 'interest') && txn.transaction_date <= upToDate) {
            manualMap[fid][aid] += amt;
        } else if (type === 'refund') {
            // Refunds always subtracted regardless of date
            manualMap[fid][aid] -= amt;
        }
    }

    // 3. Merge: balance = collection deposits + manual entries
    const map = {};
    // Start from collection deposits
    for (const [aid, { deposited, farmerId }] of Object.entries(depositTotals)) {
        const fid = farmerId;
        if (!map[fid]) map[fid] = {};
        map[fid][aid] = deposited;
    }
    // Add manual entries
    for (const [fid, accounts] of Object.entries(manualMap)) {
        if (!map[fid]) map[fid] = {};
        for (const [aid, amount] of Object.entries(accounts)) {
            map[fid][aid] = (map[fid][aid] || 0) + amount;
        }
    }
    // Clamp to 0, round to 2dp
    for (const fid of Object.keys(map)) {
        for (const aid of Object.keys(map[fid])) {
            map[fid][aid] = Math.max(0, Math.round(map[fid][aid] * 100) / 100);
        }
    }
    return map;
};

export const recordThevDeposit = async ({ dairyId, farmerId, thevAccountId, amount, transactionDate, liters, referenceCollectionId, rate, deductionType, skipBalanceAfterUpdate = false }) => {
    if (!dairyId || !farmerId || !thevAccountId) throw new Error('dairyId, farmerId, thevAccountId are required');
    const depositAmt = parseFloat(amount) || 0;
    if (depositAmt <= 0) return null;

    // Build descriptive remarks including per-liter rate
    let remarks = 'ठेव जमा';
    if (liters) {
        if (deductionType === 'per_liter' && rate) {
            remarks = `${liters} लिटर × ₹${rate}/L = ₹${parseFloat(depositAmt.toFixed(2))} ठेव जमा`;
        } else {
            remarks = `${liters} लिटर दुधावर ठेव जमा`;
        }
    }

    // Step 1: Insert transaction (balance_after will be patched below)
    const { data: txn, error: txnErr } = await supabase
        .from('thev_transactions')
        .insert([{
            dairy_id: dairyId,
            farmer_id: farmerId,
            thev_account_id: thevAccountId,
            transaction_type: 'deposit',
            amount: depositAmt,
            interest_amount: 0,
            balance_after: 0, // Patched below (or lazily by repairAllThevBalances)
            remarks,
            transaction_date: transactionDate || new Date().toISOString().split('T')[0],
            reference_collection_id: referenceCollectionId || null
        }])
        .select().single();
    if (txnErr) throw txnErr;

    // Step 2: Update farmer_thev_accounts.current_balance
    //
    // FAST PATH (skipBalanceAfterUpdate=true, used from Collection auto-deposit):
    //   Fetch a SUM from the DB — just 1 query, then update the account.
    //   Skips the N-loop that updates balance_after on every past transaction row.
    //   balance_after per row is repaired lazily by repairAllThevBalances / Repair button.
    //
    // SLOW PATH (default, used from manual deposit UI):
    //   Fetches all transactions and updates balance_after on each row (N DB calls).
    //   Needed for accurate ledger display when the user is actively viewing it.
    if (skipBalanceAfterUpdate) {
        // Fast path: single aggregate query to get totals
        const { data: sums } = await supabase
            .from('thev_transactions')
            .select('transaction_type, amount')
            .eq('thev_account_id', thevAccountId)
            .eq('dairy_id', dairyId);

        if (sums) {
            const totalDeposited = sums.filter(t => ['deposit', 'opening'].includes(t.transaction_type)).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            const totalRefunded  = sums.filter(t => t.transaction_type === 'refund').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            const currentBalance = Math.max(0, totalDeposited - totalRefunded);
            await supabase.from('farmer_thev_accounts')
                .update({ current_balance: parseFloat(currentBalance.toFixed(2)), total_deposited: parseFloat(totalDeposited.toFixed(2)), total_refunded: parseFloat(totalRefunded.toFixed(2)) })
                .eq('id', thevAccountId)
                .eq('dairy_id', dairyId);
        }
    } else {
        // Slow path: fetch all transactions ordered and update balance_after on each
        const { data: allTxnsOrdered } = await supabase
            .from('thev_transactions')
            .select('id, transaction_type, amount')
            .eq('thev_account_id', thevAccountId)
            .eq('dairy_id', dairyId)
            .order('transaction_date', { ascending: true })
            .order('id', { ascending: true });

        let running = 0;
        if (allTxnsOrdered) {
            for (const t of allTxnsOrdered) {
                const amt = parseFloat(t.amount || 0);
                if (['deposit', 'opening', 'interest'].includes(t.transaction_type)) running += amt;
                else if (t.transaction_type === 'refund') running -= amt;
                running = Math.max(0, running);
                await supabase.from('thev_transactions')
                    .update({ balance_after: parseFloat(running.toFixed(2)) })
                    .eq('id', t.id).eq('dairy_id', dairyId);
            }
            const totalDeposited = allTxnsOrdered.filter(t => ['deposit', 'opening'].includes(t.transaction_type)).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            const totalRefunded  = allTxnsOrdered.filter(t => t.transaction_type === 'refund').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            await supabase.from('farmer_thev_accounts')
                .update({ current_balance: parseFloat(running.toFixed(2)), total_deposited: parseFloat(totalDeposited.toFixed(2)), total_refunded: parseFloat(totalRefunded.toFixed(2)) })
                .eq('id', thevAccountId)
                .eq('dairy_id', dairyId);
        }
    }

    return txn;
};

export const syncThevDepositForCollection = async ({ dairyId, farmerId, thevAccountId, amount, liters, transactionDate, referenceCollectionId, rate, deductionType }) => {
    if (!dairyId || !farmerId || !thevAccountId || !referenceCollectionId) return null;
    
    // Step 1: Delete the existing entry for THIS specific thev account linked to this collection.
    // IMPORTANT: must filter by thev_account_id so that when a farmer has multiple Thev accounts,
    // re-syncing account B does NOT delete account A's transaction for the same collection.
    await supabase
        .from('thev_transactions')
        .delete()
        .eq('reference_collection_id', referenceCollectionId)
        .eq('thev_account_id', thevAccountId)
        .eq('dairy_id', dairyId);

    // Step 2: Also delete any legacy entries on same farmer+date with no reference_collection_id
    // (handles entries saved before reference_collection_id tracking was added)
    if (transactionDate) {
        const { data: legacyTxns } = await supabase
            .from('thev_transactions')
            .select('id')
            .eq('dairy_id', dairyId)
            .eq('farmer_id', farmerId)
            .eq('thev_account_id', thevAccountId)
            .eq('transaction_date', transactionDate)
            .eq('transaction_type', 'deposit')
            .is('reference_collection_id', null);

        if (legacyTxns && legacyTxns.length > 0) {
            const ids = legacyTxns.map(t => t.id);
            await supabase.from('thev_transactions').delete().in('id', ids);
        }
    }
        
    // Step 3: Insert new deposit if amount > 0
    if (parseFloat(amount) > 0) {
        return await recordThevDeposit({
            dairyId,
            farmerId,
            thevAccountId,
            amount,
            liters,
            transactionDate,
            referenceCollectionId,
            rate,
            deductionType
        });
    }

    // Amount is 0 — we deleted entries but didn't insert. Recalculate balance from scratch.
    const { data: allTxns } = await supabase
        .from('thev_transactions')
        .select('transaction_type, amount')
        .eq('thev_account_id', thevAccountId)
        .eq('dairy_id', dairyId);
    
    if (allTxns !== null) {
        const totalDeposited = allTxns
            .filter(t => ['deposit', 'opening'].includes(t.transaction_type))
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const totalRefunded = allTxns
            .filter(t => t.transaction_type === 'refund')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const currentBalance = totalDeposited - totalRefunded;
        await supabase
            .from('farmer_thev_accounts')
            .update({ current_balance: currentBalance, total_deposited: totalDeposited, total_refunded: totalRefunded })
            .eq('id', thevAccountId)
            .eq('dairy_id', dairyId);
    }

    return null;
};

export const processThevRefund = async ({ dairyId, farmerId, thevAccountId, refundAmount, interestAmount, startDate, endDate, remarks }) => {

    if (!dairyId || !farmerId || !thevAccountId) throw new Error('dairyId, farmerId, thevAccountId are required');
    const refund = parseFloat(refundAmount) || 0;
    const interest = parseFloat(interestAmount) || 0;
    const totalPayout = refund + interest;
    if (refund <= 0) throw new Error('Refund amount must be greater than 0');

    // Get current account
    const { data: acc, error: accErr } = await supabase
        .from('farmer_thev_accounts')
        .select('current_balance, total_refunded')
        .eq('id', thevAccountId)
        .single();
    if (accErr) throw accErr;

    const currentBal = parseFloat(acc.current_balance || 0);
    if (refund > currentBal) throw new Error(`Refund (₹${refund}) cannot exceed current balance (₹${currentBal})`);

    const newBalance = Math.max(0, currentBal - refund);
    const newTotalRefunded = parseFloat(acc.total_refunded || 0) + refund;

    // Update account balance
    const { error: updateErr } = await supabase
        .from('farmer_thev_accounts')
        .update({ current_balance: newBalance, total_refunded: newTotalRefunded })
        .eq('id', thevAccountId)
        .eq('dairy_id', dairyId);
    if (updateErr) throw updateErr;

    // Insert refund transaction
    const remarkText = remarks || (startDate && endDate
        ? `ठेव परतावा (${startDate} ते ${endDate})`
        : 'ठेव परतावा');
    const { data: txn, error: txnErr } = await supabase
        .from('thev_transactions')
        .insert([{
            dairy_id: dairyId,
            farmer_id: farmerId,
            thev_account_id: thevAccountId,
            transaction_type: 'refund',
            amount: refund,
            interest_amount: interest,
            balance_after: newBalance,
            remarks: remarkText,
            transaction_date: new Date().toISOString().split('T')[0]
        }])
        .select().single();
    if (txnErr) throw txnErr;
    return { ...txn, newBalance, totalPayout };
};

export const getThevRefundHistory = async (dairyId, startDate, endDate, farmerId) => {
    let query = supabase
        .from('thev_transactions')
        .select('*')
        .eq('dairy_id', dairyId)
        .eq('transaction_type', 'refund');
    if (farmerId) query = query.eq('farmer_id', farmerId);
    if (startDate) query = query.gte('transaction_date', startDate);
    if (endDate) query = query.lte('transaction_date', endDate);
    const { data: txns, error } = await query.order('transaction_date', { ascending: false });
    if (error) throw error;
    if (!txns || txns.length === 0) return [];
    // Fetch farmer names separately (no PostgREST join — FK may not be registered)
    const farmerIds = [...new Set(txns.map(t => t.farmer_id).filter(Boolean))];
    const farmersRes = farmerIds.length > 0
        ? await supabase.from('farmers').select('id, name, code').in('id', farmerIds)
        : { data: [] };
    const farmersMap = Object.fromEntries((farmersRes.data || []).map(f => [f.id, f]));
    return txns.map(r => ({
        ...r,
        farmer_name: farmersMap[r.farmer_id]?.name || '',
        farmer_code: farmersMap[r.farmer_id]?.code || '',
    }));
};

// ─────────────────────────────────────────────────────────────────────────────

export const getSettings = async () => {
    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || {};
};

export const saveSetting = async (setting) => {
    const { data, error } = await supabase
        .from('settings')
        .upsert([setting])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getDairies = async () => {
    const { data, error } = await supabase
        .from('dairies')
        .select('*')
        .eq('is_deleted', false)
        .order('name');
    if (error) throw error;
    return (data || []).map(d => ({ ...d, contact_info: d.address }));
};

export const addDairy = async (dairy) => {
    // First, create the dairy
    const { data: dairyData, error: dairyError } = await supabase
        .from('dairies')
        .insert([{
            name: dairy.name,
            code: dairy.code,
            address: dairy.contact_info, // Map contact_info to address
            is_active: true,
            is_deleted: false
        }])
        .select()
        .single();

    if (dairyError) throw dairyError;

    // Then create the admin user for this dairy
    try {
        const hashedPassword = await hashPassword(dairy.admin_password);
        const { error: userError } = await supabase
            .from('users')
            .insert([{
                username: dairy.admin_username,
                password: hashedPassword,
                role: 'admin',
                dairy_id: dairyData.id
            }])
            .select();

        if (userError) {

            await supabase.from('dairies').delete().eq('id', dairyData.id);
            throw userError;
        }
    } catch (err) {
        await supabase.from('dairies').delete().eq('id', dairyData.id);
        throw err;
    }

    return { ...dairyData, contact_info: dairyData.address };
};

export const toggleDairyStatus = async (dairyId, isActive) => {
    const { data, error } = await supabase
        .from('dairies')
        .update({ is_active: isActive })
        .eq('id', dairyId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteDairy = async (dairyId) => {
    const { data: dairy, error: dairyError } = await supabase
        .from('dairies')
        .update({ is_deleted: true, deleted_at: new Date() })
        .eq('id', dairyId)
        .select()
        .single();

    if (dairyError) throw dairyError;


    const { error: userError } = await supabase
        .from('users')
        .update({ deleted_at: new Date() })
        .eq('dairy_id', dairyId);

    if (userError) console.error("Error soft-deleting admin user:", userError);

    return dairy;
};

export const getDeletedDairies = async () => {
    const { data, error } = await supabase
        .from('dairies')
        .select('*')
        .eq('is_deleted', true)
        .order('name');

    if (error) throw error;
    return data || [];
};

export const restoreDairy = async (dairyId) => {

    const { data: dairy, error: dairyError } = await supabase
        .from('dairies')
        .update({ is_deleted: false, is_active: true })
        .eq('id', dairyId)
        .select()
        .single();

    if (dairyError) throw dairyError;


    const { error: userError } = await supabase
        .from('users')
        .update({ deleted_at: null })
        .eq('dairy_id', dairyId);

    if (userError) console.error("Error restoring admin users:", userError);

    return dairy;
};



export const permanentDeleteDairy = async (dairyId) => {
    // Note: No optional dairy_id here as this is a root table delete (usually Super Admin)
    const { error } = await supabase
        .from('dairies')
        .delete()
        .eq('id', dairyId);

    if (error) throw error;
    return { success: true };
};

export const getDairySubscriptions = async (dairyId) => {
    const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('dairy_id', dairyId)
        .order('start_date', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const addSubscription = async (subscription) => {
    const { data, error } = await supabase
        .from('subscriptions')
        .insert([subscription])
        .select()
        .single();

    if (error) throw error;
    return data;
};

// â”€â”€â”€ INVENTORY API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getInventoryItems = async (dairyId) => {
    const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('dairy_id', dairyId)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const addInventoryItem = async (item) => {
    const { data, error } = await supabase
        .from('inventory_items')
        .insert([item])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateInventoryItem = async (item) => {
    const { data, error } = await supabase
        .from('inventory_items')
        .update(item)
        .eq('id', item.id)
        .eq('dairy_id', item.dairy_id)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteInventoryItem = async (id, dairyId) => {
    const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id)
        .eq('dairy_id', dairyId);
    if (error) throw error;
    return true;
};

export const getInventoryTransactions = async (dairyId, filters = {}) => {
    let query = supabase
        .from('inventory_transactions')
        .select('*, inventory_items(name, unit)')
        .eq('dairy_id', dairyId)
        .order('transaction_date', { ascending: false });

    if (filters.itemId) query = query.eq('item_id', filters.itemId);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.farmerId) query = query.eq('farmer_id', filters.farmerId);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(tx => ({
        ...tx,
        item_name: tx.inventory_items?.name,
        item_unit: tx.inventory_items?.unit
    }));
};

export const addInventoryTransaction = async (tx) => {
    const { data, error } = await supabase
        .from('inventory_transactions')
        .insert([tx])
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteInventoryTransaction = async (id, dairyId) => {
    const { error } = await supabase
        .from('inventory_transactions')
        .delete()
        .eq('id', id)
        .eq('dairy_id', dairyId);
    if (error) throw error;
    return true;
};

// ─────────────────────────────────────────────────────────────────────────────

export const toggleMaintenanceMode = async (isEnabled) => {
    const { data, error } = await supabase
        .from('settings')
        .upsert([
            { key: 'global_settings', maintenance_mode: isEnabled }
        ], { onConflict: 'key' });

    if (error) throw error;
    return isEnabled;
};

export const login = async ({ username, password, role, dairyCode }) => {
    try {
        const email = `${username}@dudhsakha.com`;
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('[API] Auth Login Error:', error);
            if (error.message === 'Failed to fetch') {
                return { success: false, error: 'Network Error: Unable to reach the server.' };
            }
            return { success: false, error: error.message };
        }

        const authUser = data.user;
        if (!authUser) return { success: false, error: 'Invalid session' };

        const { data: user, error: profileError } = await supabase
            .from('users')
            .select('*, dairies(name)')
            .eq('username', username)
            .single();

        if (profileError || !user) {
            console.error('[API] Profile Fetch Error:', profileError);
            return { success: false, error: 'User profile not found.' };
        }

        if (window.electron && window.electron.getMachineId) {
            const machineResult = await window.electron.getMachineId();
            if (machineResult.success) {
                const currentMachineId = machineResult.machineId;
                const isAdmin = user.role === 'admin' || user.role === 'super_admin';
                const limit = user.device_limit != null ? Number(user.device_limit) : (isAdmin ? 2 : 1);
                const boundDevices = user.device_id
                    ? user.device_id.split(',').map(d => d.trim()).filter(Boolean)
                    : [];
                const alreadyBound = boundDevices.includes(currentMachineId);

                if (!user.device_id) {
                    console.log('[API] First login: binding this PC to account.');
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({ device_id: currentMachineId })
                        .eq('id', user.id);
                    if (updateError) {
                        console.error('[API] Failed to bind device:', updateError);
                        return { success: false, error: 'Failed to bind device to account.' };
                    }
                    user.device_id = currentMachineId;
                } else if (alreadyBound) {
                    console.log('[API] Recognized PC, login allowed.');
                } else if (boundDevices.length < limit) {
                    const newDeviceString = boundDevices.concat(currentMachineId).join(',');
                    console.log(`[API] Binding additional PC (${boundDevices.length + 1}/${limit}).`);
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({ device_id: newDeviceString })
                        .eq('id', user.id);
                    if (updateError) {
                        console.error('[API] Failed to bind additional device:', updateError);
                        return { success: false, error: 'Failed to bind additional device to account.' };
                    }
                    user.device_id = newDeviceString;
                } else {
                    console.error(`[API] Device limit (${limit}) reached. Login rejected.`);
                    await supabase.auth.signOut();
                    return {
                        success: false,
                        error: isAdmin
                            ? `Device Limit Reached: Your admin account is already bound to ${limit} computer(s). Ask a super-admin to reset your device access.`
                            : `Device Limit Reached: Your employee account is already bound to ${limit} computer(s). Ask your administrator to reset your device access.`
                    };
                }
            } else {
                console.warn('[API] Could not fetch machine ID from Electron. Proceeding with caution.');
            }
        }

        return {
            success: true,
            user: {
                ...user,
                dairy_name: user.dairies?.name
            }
        };
    } catch (err) {
        console.error('[API] Login Exception:', err);

        return { success: false, error: 'An unexpected error occurred during login.' };
    }
};



export const resetOperatorDevice = async (userId, dairyId) => {
    const { data, error } = await supabase
        .from('users')
        .update({ device_id: null })
        .eq('id', userId)
        .eq('dairy_id', dairyId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getUserProfile = async (userId) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data;
};



if (typeof window !== 'undefined') {
    const dbApi = {
        getFarmers,
        addFarmer,
        getSuperAdminStats: async () => {
            try {
                const { data, error } = await supabase.rpc('get_dashboard_stats');
                if (error) { console.error('Stats RPC Error:', error); return null; }
                if (data && data.error) { console.error('Stats Access Error:', data.error); return null; }
                if (data && data.recentDairies) {
                    data.recentDairies = data.recentDairies.map(d => ({ ...d, contact_info: d.address }));
                }
                return data;
            } catch (err) { console.error('Failed to fetch stats:', err); return null; }
        },
        updateFarmer,
        softDeleteFarmer,
        getDeletedFarmers,
        restoreFarmer,
        permanentDeleteFarmer,
        resetFarmerDevice,
        getCollections,
        addCollection,
        updateCollection,
        deleteCollection,
        getLastFarmerEntry,
        getRates,
        saveRates,
        getRateForCollection,
        getSellingRates,
        saveSellingRates,
        getMilkSales,
        addMilkSale,
        updateMilkSale,
        deleteMilkSale,
        getFederationReceipts,
        addFederationReceipt,
        updateFederationReceipt,
        deleteFederationReceipt,
        getUsers,
        addUser,
        updateUser,
        deleteUser,
        resetOperatorDevice,
        getDeductionMasters,
        addDeductionMaster,
        updateDeductionMaster,
        deleteDeductionMaster,
        getFarmerDeductions,
        assignDeduction,
        deleteFarmerDeduction,
        removeDeductionFromHistory,
        getBillPayments,
        getFarmerDeductionLogs,
        processBillPayment,
        revertBillPayment,
        getSettings,
        saveSetting,
        getDairies,
        addDairy,
        toggleDairyStatus,
        deleteDairy,
        getDeletedDairies,
        restoreDairy,
        permanentDeleteDairy,
        getDairySubscriptions,
        addSubscription,
        checkSubscription: async (dairyId) => {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('dairy_id', dairyId)
                .eq('status', 'active')
                .lte('start_date', today)
                .gte('end_date', today)
                .maybeSingle();
            if (error) { console.error('Error fetching subscription details:', error); return false; }
            return data !== null;
        },
        toggleMaintenanceMode,
        getFarmerCollections,
        getFarmerPayments,
        login,
        getInventoryItems,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        getInventoryTransactions,
        addInventoryTransaction,
        deleteInventoryTransaction,
        getThevMasters,
        saveThevMaster,
        recalcThevFromDate,
        deleteThevMaster,
        getFarmerThevAccounts,
        assignFarmerThev,
        updateFarmerThevAccount,
        deleteFarmerThevAccount,
        getFarmerThevLedger,
        getThevTransactionsForBilling,
        getThevBalancesUpToDate,
        recordThevDeposit,
        syncThevDepositForCollection,
        processThevRefund,
        getThevRefundHistory,
        rebackfillThevAccount,
        repairAllThevBalances,
        deleteThevTransaction: async (id, dairyId) => {
            if (!dairyId) throw new Error('[Security] dairyId required');
            const { error } = await supabase.from('thev_transactions').delete().eq('id', id).eq('dairy_id', dairyId);
            if (error) throw error;
        },
        updateThevTransactionBalance: async (id, dairyId, balanceAfter) => {
            if (!dairyId) throw new Error('[Security] dairyId required');
            const { error } = await supabase.from('thev_transactions')
                .update({ balance_after: balanceAfter })
                .eq('id', id).eq('dairy_id', dairyId);
            if (error) throw error;
        },
    };

    window.api = {
        ...(window.api || {}),
        ...dbApi
    };
}

// ─── Employee Permissions ──────────────────────────────────────────────────
export const DEFAULT_EMPLOYEE_PERMISSIONS = {
    collection: true,
    milk_sale: true,
    milk_sale_billing: false,
    billing: false,
    rates: false,
    deductions: false,
    farmers: false,
    members: false,
    reports: false,
    advanced_reports: false,
    federation_receipt: false,
    inventory: false,
    manage_customers: false,
    can_view_past_data: false,
    can_save_past_entry: false,
    can_edit_saved_entry: false,
    can_delete_entry: false,
};

export const getEmployeePermissions = async (userId, dairyId) => {
    if (!userId || !dairyId) return null;
    const { data, error } = await supabase.rpc('get_employee_permissions', {
        p_user_id: userId,
        p_dairy_id: dairyId
    });
    if (error) { console.error('[Permissions] Error fetching employee permissions:', error); return null; }
    return data || null;
};

// Uses a SECURITY DEFINER RPC to bypass RLS without service role key in frontend.
// Run fix_permissions_sql.sql once in Supabase Dashboard -> SQL Editor.
export const saveEmployeePermissions = async (userId, dairyId, permissions) => {
    if (!userId || !dairyId) throw new Error('userId and dairyId are required');
    const { error } = await supabase.rpc('save_employee_permissions', {
        p_user_id: userId,
        p_dairy_id: dairyId,
        p_permissions: permissions
    });
    if (error) { console.error('[Permissions] Error saving employee permissions:', error); throw error; }
    return true;
};

export const resolvePermissions = (role, permissionsRow) => {
    if (role === 'admin' || role === 'super_admin') {
        return Object.fromEntries(Object.keys(DEFAULT_EMPLOYEE_PERMISSIONS).map(k => [k, true]));
    }
    if (!permissionsRow || Object.keys(permissionsRow).length === 0) {
        return Object.fromEntries(Object.keys(DEFAULT_EMPLOYEE_PERMISSIONS).map(k => [k, true]));
    }
    return { ...DEFAULT_EMPLOYEE_PERMISSIONS, ...permissionsRow };
};

export const deleteThevTransaction = async (id, dairyId) => {
    // Fetch the transaction first to know which account to recalculate
    const { data: txnToDelete } = await supabase
        .from('thev_transactions')
        .select('thev_account_id')
        .eq('id', id)
        .eq('dairy_id', dairyId)
        .single();

    const { error } = await supabase.from('thev_transactions').delete().eq('id', id).eq('dairy_id', dairyId);
    if (error) throw error;

    // Recalculate account balance from scratch after deletion
    if (txnToDelete?.thev_account_id) {
        const { data: allTxns } = await supabase
            .from('thev_transactions')
            .select('transaction_type, amount')
            .eq('thev_account_id', txnToDelete.thev_account_id)
            .eq('dairy_id', dairyId);

        if (allTxns !== null) {
            const totalDeposited = allTxns
                .filter(t => ['deposit', 'opening'].includes(t.transaction_type))
                .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
            const totalRefunded = allTxns
                .filter(t => t.transaction_type === 'refund')
                .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
            const currentBalance = totalDeposited - totalRefunded;
            await supabase
                .from('farmer_thev_accounts')
                .update({ current_balance: currentBalance, total_deposited: totalDeposited, total_refunded: totalRefunded })
                .eq('id', txnToDelete.thev_account_id)
                .eq('dairy_id', dairyId);
        }
    }

    return true;
};
