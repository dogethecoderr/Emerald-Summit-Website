import 'package:flutter/material.dart';

/// The roles a Summit account can hold. Picked during sign-up; drives which
/// onboarding fields we collect and (later) which RLS-scoped data the user
/// sees. Stored as `profiles.role` (the enum `name`, e.g. "ambassador").
enum SummitRole { participant, ambassador, expert, parent, admin }

/// One extra field collected during onboarding for a given role. The [key]
/// is where the answer lands in `profiles.details` (a jsonb bag), so roles
/// can ask for different things without a column per field.
class ProfileField {
  const ProfileField({
    required this.key,
    required this.label,
    this.hint,
    this.required = false,
    this.keyboardType = TextInputType.text,
  });

  final String key;
  final String label;
  final String? hint;
  final bool required;
  final TextInputType keyboardType;
}

extension SummitRoleX on SummitRole {
  /// Value stored in the database.
  String get id => name;

  String get label => switch (this) {
        SummitRole.participant => 'Participant',
        SummitRole.ambassador => 'Ambassador',
        SummitRole.expert => 'Expert / Speaker',
        SummitRole.parent => 'Parent / Guardian',
        SummitRole.admin => 'Organizer',
      };

  String get blurb => switch (this) {
        SummitRole.participant =>
          'Build your schedule and follow your summit day.',
        SummitRole.ambassador =>
          'Volunteer and help run the summit on the ground.',
        SummitRole.expert => 'Lead a session or speak at the summit.',
        SummitRole.parent => 'Follow along and stay in the loop.',
        SummitRole.admin => 'Manage the summit, announcements, and users.',
      };

  IconData get icon => switch (this) {
        SummitRole.participant => Icons.school_outlined,
        SummitRole.ambassador => Icons.volunteer_activism_outlined,
        SummitRole.expert => Icons.mic_none_outlined,
        SummitRole.parent => Icons.family_restroom_outlined,
        SummitRole.admin => Icons.admin_panel_settings_outlined,
      };

  /// Role-specific onboarding questions, asked after name + role.
  ///
  /// The design intent (per spec): ask ambassadors for full contact details
  /// since they're staffing the event, but keep experts light — we don't want
  /// to over-collect from busy speakers.
  List<ProfileField> get onboardingFields => switch (this) {
        SummitRole.participant => const [
            ProfileField(key: 'school', label: 'School', hint: 'e.g. Emerald High'),
            ProfileField(key: 'grade', label: 'Grade', hint: 'e.g. 11'),
            ProfileField(
                key: 'dietary',
                label: 'Dietary needs (optional)',
                hint: 'e.g. vegetarian, nut allergy'),
          ],
        SummitRole.ambassador => const [
            ProfileField(key: 'school', label: 'School', hint: 'e.g. Emerald High'),
            ProfileField(key: 'grade', label: 'Grade', hint: 'e.g. 11'),
            ProfileField(
                key: 'phone',
                label: 'Mobile number',
                required: true,
                hint: 'For day-of coordination',
                keyboardType: TextInputType.phone),
            ProfileField(
                key: 'emergency_contact',
                label: 'Emergency contact name',
                required: true),
            ProfileField(
                key: 'emergency_phone',
                label: 'Emergency contact number',
                required: true,
                keyboardType: TextInputType.phone),
            ProfileField(
                key: 'dietary',
                label: 'Dietary needs (optional)',
                hint: 'e.g. vegetarian, nut allergy'),
          ],
        SummitRole.expert => const [
            ProfileField(
                key: 'organization',
                label: 'Organization',
                required: true,
                hint: 'Company, lab, or school'),
            ProfileField(
                key: 'expertise',
                label: 'Area of expertise',
                required: true,
                hint: 'e.g. Robotics, Bioengineering'),
          ],
        SummitRole.parent => const [
            ProfileField(
                key: 'phone',
                label: 'Mobile number',
                required: true,
                keyboardType: TextInputType.phone),
            ProfileField(
                key: 'student_name',
                label: "Student's name",
                required: true),
          ],
        SummitRole.admin => const [],
      };

  static SummitRole fromId(String? id) => SummitRole.values.firstWhere(
        (r) => r.name == id,
        orElse: () => SummitRole.participant,
      );
}

/// A user's app-facing profile — mirrors a row in the `profiles` table. Bound
/// to the auth account (and therefore the email) by [id], so it follows the
/// user across devices and across a future switch from OTP to Google sign-in.
class UserProfile {
  UserProfile({
    required this.id,
    required this.email,
    this.fullName = '',
    this.role = SummitRole.participant,
    this.onboarded = false,
    Map<String, dynamic>? details,
  }) : details = details ?? <String, dynamic>{};

  final String id;
  final String email;
  String fullName;
  SummitRole role;
  bool onboarded;

  /// Role-specific answers (phone, school, org…) → `profiles.details` jsonb.
  final Map<String, dynamic> details;

  factory UserProfile.fromMap(Map<String, dynamic> row) => UserProfile(
        id: row['id'] as String,
        email: (row['email'] ?? '') as String,
        fullName: (row['full_name'] ?? '') as String,
        role: SummitRoleX.fromId(row['role'] as String?),
        onboarded: (row['onboarded'] ?? false) as bool,
        details: (row['details'] as Map?)?.cast<String, dynamic>() ?? {},
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'email': email,
        'full_name': fullName,
        'role': role.id,
        'details': details,
        'onboarded': onboarded,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      };
}
