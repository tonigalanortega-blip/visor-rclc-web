import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htaxbkabqysyhjpmnlzl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0YXhia2FicXlzeWhqcG1ubHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTMzMDgsImV4cCI6MjA3MDU2OTMwOH0.9W8Celtnv4WpxOFnmlIdYCpsfRK0nFDBNiwn8dLAzIw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);