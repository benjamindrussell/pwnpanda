import { Convo } from '@/types/convo.types';
import { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';
import { supabase } from '../supabase';

export const getUser = cache(async (supabase: SupabaseClient) => {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
});

export const getSubscription = cache(async (supabase: SupabaseClient) => {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, prices(*, products(*))')
    .in('status', ['trialing', 'active'])
    .order('created', { ascending: false })
    .limit(1)
    .maybeSingle();

  return subscription;
});

export const getProducts = cache(async (supabase: SupabaseClient) => {
  const { data: products } = await supabase
    .from('products')
    .select('*, prices(*)')
    .eq('active', true)
    .eq('prices.active', true)
    .order('metadata->index')
    .order('unit_amount', { referencedTable: 'prices' });

  return products;
});

export const getUserDetails = cache(async (supabase: SupabaseClient) => {
  const { data: userDetails } = await supabase
    .from('users')
    .select('*')
    .single();
  return userDetails;
});

export const createConversation = cache(async (supabase: SupabaseClient, convo : Convo) => {
  const { data, error } = await supabase
    .from('conversation')
    .insert([
      {
        // id: convo.id,
        userId: convo.userId,
        content: convo.message,
        createdAt: convo.createdAt,
        title: convo.title,
      }
    ])
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return { data, error };
});
