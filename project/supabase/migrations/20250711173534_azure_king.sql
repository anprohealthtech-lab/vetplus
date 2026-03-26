EATE POLICY "Admins can update patients" ON patients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete patients" ON patients FOR DELETE TO authenticated USING (true);

-- Analytes: Read access for all authenticated users, write access for lab managers and admins
CREATE POLICY "Users can read analytes" ON analytes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lab managers can modify analytes" ON analytes FOR ALL TO authenticated USING (true);

-- Test Groups: Read access for all, write access for lab managers and admins
CREATE POLICY "Users can read test groups" ON test_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lab managers can modify test groups" ON test_groups FOR ALL TO authenticated USING (true);

-- Test Group Analytes: Read access for all, write access for lab managers and admins
CREATE POLICY "Users can read test group analytes" ON test_group_analytes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lab managers can modify test group analytes" ON test_group_analytes FOR ALL TO authenticated USING (true);

-- Tests (Legacy): Read access for all, write access for lab managers and admins
CREATE POLICY "Users can read tests" ON tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lab managers can modify tests" ON tests FOR ALL TO authenticated USING (true);

-- Packages: Read access for all, write access for lab managers and admins
CREATE POLICY "Users can read packages" ON packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lab managers can modify packages" ON packages FOR ALL TO authenticated USING (true);

-- Package Test Groups: Read access for all, write access for lab managers and admins
CREATE POLICY "Users can read package test groups" ON package_test_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lab managers can modify package test groups" ON package_test_groups FOR ALL TO authenticated USING (true);

-- Orders: Users can read all orders, create new orders, lab staff can modify
CREATE POLICY "Users can read orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Lab staff can modify orders" ON orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete orders" ON orders FOR DELETE TO authenticated USING (true);

-- Order Test Groups: Read access for all, write access for lab staff
CREATE POLICY "Users can read order test groups" ON order_test_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lab staff can modify order test groups" ON order_test_groups FOR ALL TO authenticated USING (true);

-- Results: Read access for all, write access for technicians and above
CREATE POLICY "Users can read results" ON results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Technicians can modify results" ON results FOR ALL TO authenticated USING (true);

-- Result Values: Read access for all, write access for technicians and above
CREATE POLICY "Users can read result values" ON result_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Technicians can modify result values" ON result_values FOR ALL TO authenticated USING (true);

-- Invoices: Read access for all, write access for billing staff and admins
CREATE POLICY "Users can read invoices" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Billing staff can modify invoices" ON invoices FOR ALL TO authenticated USING (true);

-- Invoice Items: Read access for all, write access for billing staff and admins
CREATE POLICY "Users can read invoice items" ON invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Billing staff can modify invoice items" ON invoice_items FOR ALL TO authenticated USING (true);

-- Reports: Read access for all, write access for lab staff and admins
CREATE POLICY "Users can read reports" ON reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lab staff can modify reports" ON reports FOR ALL TO authenticated USING (true);

-- Users: Users can read their own data, admins can manage all users
CREATE POLICY "Users can read own data" ON users FOR SELECT TO authenticated USING (auth.email() = email);
CREATE POLICY "Admins can manage users" ON users FOR ALL TO authenticated USING (true);

-- Audit Logs: Read-only for all authenticated users
CREATE POLICY "Users can read audit logs" ON audit_logs FOR SELECT TO authenticated USING (true);

-- Insert sample data for testing

-- Sample analytes
INSERT INTO analytes (name, unit, reference_range, low_critical, high_critical, interpretation_low, interpretation_normal, interpretation_high, category) VALUES
('Hemoglobin', 'g/dL', 'M: 13.5-17.5, F: 12.0-16.0', '7.0', '20.0', 'Anemia, blood loss, nutritional deficiency', 'Normal oxygen-carrying capacity', 'Polycythemia, dehydration, smoking', 'Hematology'),
('WBC Count', '/μL', '4,000-11,000', '2,000', '30,000', 'Immunosuppression, bone marrow disorder', 'Normal immune function', 'Infection, inflammation, leukemia', 'Hematology'),
('Platelet Count', '/μL', '150,000-450,000', '50,000', '1,000,000', 'Bleeding risk, thrombocytopenia', 'Normal clotting function', 'Thrombosis risk, myeloproliferative disorder', 'Hematology'),
('SGOT (AST)', 'U/L', '10-40', NULL, '200', 'Not clinically significant', 'Normal liver function', 'Liver damage, muscle damage, heart attack', 'Biochemistry'),
('SGPT (ALT)', 'U/L', '7-56', NULL, '200', 'Not clinically significant', 'Normal liver function', 'Liver damage, hepatitis, medication toxicity', 'Biochemistry'),
('Total Cholesterol', 'mg/dL', '<200', NULL, '300', 'Low cardiovascular risk', 'Desirable level', 'Increased cardiovascular risk', 'Biochemistry'),
('HDL Cholesterol', 'mg/dL', 'M: >40, F: >50', '20', NULL, 'Increased cardiovascular risk', 'Protective against heart disease', 'Very protective, excellent', 'Biochemistry'),
('LDL Cholesterol', 'mg/dL', '<100', NULL, '190', 'Low cardiovascular risk', 'Optimal level', 'Increased cardiovascular risk', 'Biochemistry');

-- Sample test groups
INSERT INTO test_groups (name, code, category, clinical_purpose, price, turnaround_time, sample_type, requires_fasting) VALUES
('Complete Blood Count (CBC)', 'CBC', 'Hematology', 'Evaluate overall health and detect blood disorders, infections, anemia, and leukemia', 350.00, '2-4 hours', 'EDTA Blood', false),
('Liver Function Test (LFT)', 'LFT', 'Biochemistry', 'Assess liver health and detect liver diseases, hepatitis, and drug toxicity', 450.00, '4-6 hours', 'Serum', false),
('Lipid Profile', 'LIPID', 'Biochemistry', 'Assess cardiovascular risk and monitor cholesterol levels', 500.00, '4-6 hours', 'Serum', true);

-- Link analytes to test groups
INSERT INTO test_group_analytes (test_group_id, analyte_id) 
SELECT tg.id, a.id 
FROM test_groups tg, analytes a 
WHERE tg.code = 'CBC' AND a.name IN ('Hemoglobin', 'WBC Count', 'Platelet Count');

INSERT INTO test_group_analytes (test_group_id, analyte_id) 
SELECT tg.id, a.id 
FROM test_groups tg, analytes a 
WHERE tg.code = 'LFT' AND a.name IN ('SGOT (AST)', 'SGPT (ALT)');

INSERT INTO test_group_analytes (test_group_id, analyte_id) 
SELECT tg.id, a.id 
FROM test_groups tg, analytes a 
WHERE tg.code = 'LIPID' AND a.name IN ('Total Cholesterol', 'HDL Cholesterol', 'LDL Cholesterol');

-- Sample packages
INSERT INTO packages (name, description, price, discount_percentage, category, validity_days) VALUES
('Basic Health Checkup', 'Comprehensive basic health screening package including blood work and essential tests', 750.00, 10, 'Preventive Care', 30),
('Executive Health Package', 'Complete executive health screening with cardiovascular and metabolic assessments', 1200.00, 15, 'Executive Care', 45),
('Cardiac Risk Assessment', 'Specialized package for cardiovascular health evaluation', 600.00, 5, 'Cardiac Care', 30);

-- Link test groups to packages
INSERT INTO package_test_groups (package_id, test_group_id)
SELECT p.id, tg.id
FROM packages p, test_groups tg
WHERE p.name = 'Basic Health Checkup' AND tg.code IN ('CBC', 'LFT');

INSERT INTO package_test_groups (package_id, test_group_id)
SELECT p.id, tg.id
FROM packages p, test_groups tg
WHERE p.name = 'Executive Health Package' AND tg.code IN ('CBC', 'LFT', 'LIPID');

INSERT INTO package_test_groups (package_id, test_group_id)
SELECT p.id, tg.id
FROM packages p, test_groups tg
WHERE p.name = 'Cardiac Risk Assessment' AND tg.code = 'LIPID';

-- Sample patients
INSERT INTO patients (name, age, gender, phone, email, address, city, state, pincode, emergency_contact, emergency_phone, blood_group, allergies, medical_history, total_tests) VALUES
('Priya Sharma', 32, 'Female', '+91 98765 43210', 'priya.sharma@email.com', '123 MG Road', 'Bangalore', 'Karnataka', '560001', 'Raj Sharma', '+91 98765 43211', 'O+', 'None', 'No significant medical history', 8),
('Rajesh Kumar', 45, 'Male', '+91 87654 32109', 'rajesh.kumar@email.com', '456 Park Street', 'Mumbai', 'Maharashtra', '400001', 'Sunita Kumar', '+91 87654 32110', 'B+', 'Penicillin', 'Diabetes Type 2', 12),
('Amit Patel', 28, 'Male', '+91 76543 21098', 'amit.patel@email.com', '789 Gandhi Nagar', 'Ahmedabad', 'Gujarat', '380001', 'Neha Patel', '+91 76543 21099', 'A+', 'None', 'No significant medical history', 3);

-- Sample users
INSERT INTO users (name, email, role, department, phone, permissions) VALUES
('Dr. Sarah Wilson', 'sarah.wilson@medilab.com', 'Admin', 'Administration', '+91 98765 43210', ARRAY['all_access', 'user_management', 'system_config']),
('Priya Sharma', 'priya.sharma@medilab.com', 'Lab Manager', 'Laboratory', '+91 87654 32109', ARRAY['test_management', 'result_approval', 'report_generation']),
('Rajesh Kumar', 'rajesh.kumar@medilab.com', 'Technician', 'Laboratory', '+91 76543 21098', ARRAY['result_entry', 'sample_processing']),
('Amit Patel', 'amit.patel@medilab.com', 'Receptionist', 'Front Office', '+91 65432 10987', ARRAY['patient_registration', 'appointment_management']);