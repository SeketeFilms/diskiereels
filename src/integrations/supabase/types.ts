export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accessibility: {
        Row: {
          alt_text: string | null
          aria_label: string | null
          created_at: string | null
          id: string
          post_id: string | null
        }
        Insert: {
          alt_text?: string | null
          aria_label?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
        }
        Update: {
          alt_text?: string | null
          aria_label?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accessibility_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      category: {
        Row: {
          description: string | null
          id: number
          name: string
        }
        Insert: {
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      content_settings: {
        Row: {
          cartoon_only_mode: boolean | null
          comments_visibility: string | null
          content_categories: string[] | null
          created_at: string | null
          id: string
          interaction_limits: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cartoon_only_mode?: boolean | null
          comments_visibility?: string | null
          content_categories?: string[] | null
          created_at?: string | null
          id?: string
          interaction_limits?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cartoon_only_mode?: boolean | null
          comments_visibility?: string | null
          content_categories?: string[] | null
          created_at?: string | null
          id?: string
          interaction_limits?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          participant_one: string
          participant_two: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one: string
          participant_two: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one?: string
          participant_two?: string
        }
        Relationships: []
      }
      creator_monetization: {
        Row: {
          created_at: string | null
          eligibility_checked_at: string | null
          id: string
          is_eligible: boolean | null
          pending_balance: number | null
          revenue_split_creator: number | null
          revenue_split_platform: number | null
          total_stars_earned: number | null
          total_withdrawn: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          eligibility_checked_at?: string | null
          id?: string
          is_eligible?: boolean | null
          pending_balance?: number | null
          revenue_split_creator?: number | null
          revenue_split_platform?: number | null
          total_stars_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          eligibility_checked_at?: string | null
          id?: string
          is_eligible?: boolean | null
          pending_balance?: number | null
          revenue_split_creator?: number | null
          revenue_split_platform?: number | null
          total_stars_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      creator_verifications: {
        Row: {
          business_document_url: string | null
          business_email: string
          company_name: string | null
          created_at: string | null
          full_name: string
          id: string
          id_document_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_document_url?: string | null
          business_email: string
          company_name?: string | null
          created_at?: string | null
          full_name: string
          id?: string
          id_document_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_document_url?: string | null
          business_email?: string
          company_name?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          id_document_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string | null
          id: string
          platform: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          document_type: string
          document_url: string
          id: string
          reviewed_at: string | null
          status: string | null
          submitted_at: string | null
          user_id: string | null
        }
        Insert: {
          document_type: string
          document_url: string
          id?: string
          reviewed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id?: string | null
        }
        Update: {
          document_type?: string
          document_url?: string
          id?: string
          reviewed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          id: string
          tag: string
        }
        Insert: {
          id?: string
          tag: string
        }
        Update: {
          id?: string
          tag?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      lovable_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
      lovable_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      merged_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          source: string
          username: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          source: string
          username?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          source?: string
          username?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string | null
          id: string
          notification_id: string | null
          response: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_id?: string | null
          response?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_id?: string | null
          response?: Json | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          comments_enabled: boolean | null
          created_at: string | null
          follows_enabled: boolean | null
          id: string
          likes_enabled: boolean | null
          new_videos_enabled: boolean | null
          push_enabled: boolean | null
          replies_enabled: boolean | null
          sound_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comments_enabled?: boolean | null
          created_at?: string | null
          follows_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          new_videos_enabled?: boolean | null
          push_enabled?: boolean | null
          replies_enabled?: boolean | null
          sound_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comments_enabled?: boolean | null
          created_at?: string | null
          follows_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          new_videos_enabled?: boolean | null
          push_enabled?: boolean | null
          replies_enabled?: boolean | null
          sound_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          badge_count: number | null
          id: string
          last_updated: string | null
          push_enabled: boolean | null
          user_id: string
        }
        Insert: {
          badge_count?: number | null
          id?: string
          last_updated?: string | null
          push_enabled?: boolean | null
          user_id: string
        }
        Update: {
          badge_count?: number | null
          id?: string
          last_updated?: string | null
          push_enabled?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          recipient_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          video_id: string | null
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          recipient_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          video_id?: string | null
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          recipient_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_controls: {
        Row: {
          bedtime_end: string | null
          bedtime_lock: boolean | null
          bedtime_start: string | null
          created_at: string | null
          id: string
          parental_pin: string | null
          profile_pin_enabled: boolean | null
          school_end_time: string | null
          school_hours_lock: boolean | null
          school_start_time: string | null
          screen_time_enabled: boolean | null
          screen_time_limit: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bedtime_end?: string | null
          bedtime_lock?: boolean | null
          bedtime_start?: string | null
          created_at?: string | null
          id?: string
          parental_pin?: string | null
          profile_pin_enabled?: boolean | null
          school_end_time?: string | null
          school_hours_lock?: boolean | null
          school_start_time?: string | null
          screen_time_enabled?: boolean | null
          screen_time_limit?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bedtime_end?: string | null
          bedtime_lock?: boolean | null
          bedtime_start?: string | null
          created_at?: string | null
          id?: string
          parental_pin?: string | null
          profile_pin_enabled?: boolean | null
          school_end_time?: string | null
          school_hours_lock?: boolean | null
          school_start_time?: string | null
          screen_time_enabled?: boolean | null
          screen_time_limit?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      playback_settings: {
        Row: {
          autoplay: boolean | null
          created_at: string | null
          id: string
          subtitles_background: string | null
          subtitles_enabled: boolean | null
          subtitles_karaoke: boolean | null
          subtitles_position: string | null
          subtitles_size: string | null
          updated_at: string | null
          user_id: string
          video_quality: string | null
        }
        Insert: {
          autoplay?: boolean | null
          created_at?: string | null
          id?: string
          subtitles_background?: string | null
          subtitles_enabled?: boolean | null
          subtitles_karaoke?: boolean | null
          subtitles_position?: string | null
          subtitles_size?: string | null
          updated_at?: string | null
          user_id: string
          video_quality?: string | null
        }
        Update: {
          autoplay?: boolean | null
          created_at?: string | null
          id?: string
          subtitles_background?: string | null
          subtitles_enabled?: boolean | null
          subtitles_karaoke?: boolean | null
          subtitles_position?: string | null
          subtitles_size?: string | null
          updated_at?: string | null
          user_id?: string
          video_quality?: string | null
        }
        Relationships: []
      }
      post_hashtags: {
        Row: {
          hashtag_id: string
          post_id: string
        }
        Insert: {
          hashtag_id: string
          post_id: string
        }
        Update: {
          hashtag_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string | null
          creator_id: string | null
          id: string
          transcription_status: string | null
          video_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          creator_id?: string | null
          id?: string
          transcription_status?: string | null
          video_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          creator_id?: string | null
          id?: string
          transcription_status?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_secrets: {
        Row: {
          created_at: string | null
          id: string
          profile_pin: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_pin?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_pin?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_range: string | null
          avatar_url: string | null
          badge_tier: string | null
          bio: string | null
          cover_photo_url: string | null
          created_at: string
          facebook_url: string | null
          followers_count: number
          following_count: number
          id: string
          instagram_url: string | null
          is_premium: boolean | null
          is_verified: boolean | null
          likes_count: number
          selected_avatar: string | null
          social_links_order: string[] | null
          social_links_visible: string[] | null
          tiktok_url: string | null
          updated_at: string
          user_type: string
          username: string
          verification_badge: string | null
          verification_tier: string | null
          videos_count: number
          youtube_url: string | null
        }
        Insert: {
          age_range?: string | null
          avatar_url?: string | null
          badge_tier?: string | null
          bio?: string | null
          cover_photo_url?: string | null
          created_at?: string
          facebook_url?: string | null
          followers_count?: number
          following_count?: number
          id?: string
          instagram_url?: string | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          likes_count?: number
          selected_avatar?: string | null
          social_links_order?: string[] | null
          social_links_visible?: string[] | null
          tiktok_url?: string | null
          updated_at?: string
          user_type?: string
          username: string
          verification_badge?: string | null
          verification_tier?: string | null
          videos_count?: number
          youtube_url?: string | null
        }
        Update: {
          age_range?: string | null
          avatar_url?: string | null
          badge_tier?: string | null
          bio?: string | null
          cover_photo_url?: string | null
          created_at?: string
          facebook_url?: string | null
          followers_count?: number
          following_count?: number
          id?: string
          instagram_url?: string | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          likes_count?: number
          selected_avatar?: string | null
          social_links_order?: string[] | null
          social_links_visible?: string[] | null
          tiktok_url?: string | null
          updated_at?: string
          user_type?: string
          username?: string
          verification_badge?: string | null
          verification_tier?: string | null
          videos_count?: number
          youtube_url?: string | null
        }
        Relationships: []
      }
      push_notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          sent: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          sent?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          sent?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          reported_id: string
          reported_type: string
          reporter_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          reported_id: string
          reported_type: string
          reporter_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          reported_id?: string
          reported_type?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_videos: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      star_balances: {
        Row: {
          balance: number
          id: string
          total_earned: number
          total_spent: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      star_packs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
          stars_amount: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_cents: number
          stars_amount: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          stars_amount?: number
        }
        Relationships: []
      }
      star_transactions: {
        Row: {
          amount: number
          created_at: string | null
          from_user_id: string | null
          id: string
          to_user_id: string | null
          type: string
          video_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          to_user_id?: string | null
          type: string
          video_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          to_user_id?: string | null
          type?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "star_transactions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_type_changes: {
        Row: {
          changed_at: string
          id: string
          new_type: string
          original_type: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_type: string
          original_type: string
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_type?: string
          original_type?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          profile_picture: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          profile_picture?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          profile_picture?: string | null
          username?: string
        }
        Relationships: []
      }
      verification_logs: {
        Row: {
          action: string
          action_at: string | null
          document_id: string | null
          id: string
          notes: string | null
          reviewer_email: string
        }
        Insert: {
          action: string
          action_at?: string | null
          document_id?: string | null
          id?: string
          notes?: string | null
          reviewer_email: string
        }
        Update: {
          action?: string
          action_at?: string | null
          document_id?: string | null
          id?: string
          notes?: string | null
          reviewer_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      video_analytics: {
        Row: {
          completed: boolean | null
          device_type: string | null
          id: string
          video_id: string
          viewer_id: string | null
          watch_duration: number
          watched_at: string | null
        }
        Insert: {
          completed?: boolean | null
          device_type?: string | null
          id?: string
          video_id: string
          viewer_id?: string | null
          watch_duration?: number
          watched_at?: string | null
        }
        Update: {
          completed?: boolean | null
          device_type?: string | null
          id?: string
          video_id?: string
          viewer_id?: string | null
          watch_duration?: number
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_video"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_analytics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_downloads: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_downloads_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_shares: {
        Row: {
          created_at: string
          id: string
          share_target: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          share_target?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          share_target?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_shares_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          category: string | null
          category_id: number | null
          comments_count: number
          created_at: string
          creator_id: string
          description: string | null
          duration: number | null
          id: string
          likes_count: number
          saves_count: number
          shares_count: number
          subtitles: Json | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          transcription_status: string | null
          updated_at: string
          video_url: string
          views_count: number
        }
        Insert: {
          category?: string | null
          category_id?: number | null
          comments_count?: number
          created_at?: string
          creator_id: string
          description?: string | null
          duration?: number | null
          id?: string
          likes_count?: number
          saves_count?: number
          shares_count?: number
          subtitles?: Json | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          transcription_status?: string | null
          updated_at?: string
          video_url: string
          views_count?: number
        }
        Update: {
          category?: string | null
          category_id?: number | null
          comments_count?: number
          created_at?: string
          creator_id?: string
          description?: string | null
          duration?: number | null
          id?: string
          likes_count?: number
          saves_count?: number
          shares_count?: number
          subtitles?: Json | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          transcription_status?: string | null
          updated_at?: string
          video_url?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "videos_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_current_user_profile: { Args: never; Returns: Json }
      get_backend_status: { Args: never; Returns: Json }
      get_creator_monetization_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          total_stars_earned: number
          user_id: string
          username: string
        }[]
      }
      get_star_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          total_earned: number
          user_id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_video_views: { Args: { _video_id: string }; Returns: undefined }
      set_parental_pin: {
        Args: { _raw_pin: string; _user_id: string }
        Returns: undefined
      }
      set_parental_pin_admin: {
        Args: { _raw_pin: string; _user_id: string }
        Returns: undefined
      }
      set_profile_pin: {
        Args: { _raw_pin: string; _user_id: string }
        Returns: undefined
      }
      set_profile_pin_admin: {
        Args: { _raw_pin: string; _user_id: string }
        Returns: undefined
      }
      verify_parental_pin: {
        Args: { _raw_pin: string; _user_id: string }
        Returns: boolean
      }
      verify_profile_pin: {
        Args: { _raw_pin: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "viewer" | "creative" | "admin"
      notification_type:
        | "like"
        | "comment"
        | "follow"
        | "reply"
        | "new_video"
        | "star_gift"
      user_type: "viewer" | "creative"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["viewer", "creative", "admin"],
      notification_type: [
        "like",
        "comment",
        "follow",
        "reply",
        "new_video",
        "star_gift",
      ],
      user_type: ["viewer", "creative"],
    },
  },
} as const
