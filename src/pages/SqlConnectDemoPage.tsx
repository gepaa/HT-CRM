import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Film, 
  Star, 
  MessageSquare, 
  Plus, 
  RefreshCw, 
  Check, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { 
  listMovies, 
  addReview, 
  upsertUser, 
  addMovie 
} from '../generated/dataconnect';
import type { ListMoviesData } from '../generated/dataconnect';

type Movie = ListMoviesData['movies'][number];

const SEED_MOVIES = [
  {
    title: 'Inception',
    genre: 'Sci-Fi',
    imageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'The Dark Knight',
    genre: 'Action',
    imageUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Interstellar',
    genre: 'Sci-Fi',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Pulp Fiction',
    genre: 'Drama',
    imageUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=800&q=80',
  },
];

export const SqlConnectDemoPage: React.FC = () => {
  const { user, crmUser } = useAuth();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  
  // Review form states
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewSuccess, setReviewSuccess] = useState<boolean>(false);

  // Genre filter state
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const genres = ['All', 'Sci-Fi', 'Action', 'Drama'];

  // Seeding states
  const [seeding, setSeeding] = useState<boolean>(false);

  // Fetch movies from Firebase SQL Connect (Data Connect)
  const fetchMovies = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await listMovies();
      setMovies(response.data.movies);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching movies:', err);
      setError(err?.message || 'Failed to connect to Firebase SQL Connect emulator on port 9399.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Sync logged in user to Data Connect User table
  useEffect(() => {
    if (user) {
      const username = crmUser?.displayName || user.displayName || user.email?.split('@')[0] || 'Anonymous';
      upsertUser({
        id: user.uid,
        username,
      }).catch((err) => {
        console.warn('Failed to sync user to SQL Connect:', err);
      });
    }
  }, [user, crmUser]);

  // Load movies on mount
  useEffect(() => {
    fetchMovies();
  }, []);

  // Update selected movie state when movies list changes to keep references fresh
  useEffect(() => {
    if (selectedMovie) {
      const updated = movies.find(m => m.id === selectedMovie.id);
      if (updated) setSelectedMovie(updated);
    }
  }, [movies]);

  // Seed database logic
  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      // First ensure the current user exists in the DB if logged in
      if (user) {
        const username = crmUser?.displayName || user.displayName || user.email?.split('@')[0] || 'Admin';
        await upsertUser({ id: user.uid, username });
      } else {
        // Create a default seed user
        await upsertUser({ id: 'system_seed_user', username: 'CinemaCritic' });
      }

      // Add movies
      for (const m of SEED_MOVIES) {
        await addMovie({
          title: m.title,
          genre: m.genre,
          imageUrl: m.imageUrl
        });
      }

      await fetchMovies(false);
      setError(null);
    } catch (err: any) {
      console.error('Seeding failed:', err);
      setError('Failed to seed movies. Ensure SQL Connect local emulators are running.');
    } finally {
      setSeeding(false);
    }
  };

  // Add review submission
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovie || !user) return;

    setSubmittingReview(true);
    setReviewSuccess(false);

    try {
      // 1. Ensure user is synced
      const username = crmUser?.displayName || user.displayName || user.email?.split('@')[0] || 'Anonymous';
      await upsertUser({
        id: user.uid,
        username,
      });

      // 2. Add review
      await addReview({
        movieId: selectedMovie.id,
        rating,
        reviewText,
      });

      setReviewText('');
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 3000);
      
      // Refresh database records
      await fetchMovies(false);
    } catch (err: any) {
      console.error('Failed to submit review:', err);
      setError(err?.message || 'Failed to submit review to local PostgreSQL.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Calculate average rating
  const getAverageRating = (movie: Movie) => {
    const reviews = movie.reviews_on_movie;
    if (!reviews || reviews.length === 0) return null;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return (sum / reviews.length).toFixed(1);
  };

  // Filtered movies
  const filteredMovies = selectedGenre === 'All'
    ? movies
    : movies.filter(m => m.genre === selectedGenre);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-950 via-surface-900 to-surface-950 border border-brand-500/20 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2 text-brand-400 font-semibold tracking-wider text-xs uppercase">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Developer Sandbox</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8 text-brand-500 shrink-0" />
            Firebase SQL Connect
          </h1>
          <p className="text-sm text-surface-400 max-w-2xl leading-relaxed">
            Harness the power of relational data in Firebase. This playground compiles your local schema and queries 
            directly into a type-safe client SDK, connecting in real-time to a PGlite PostgreSQL database.
          </p>
        </div>
        <button
          onClick={() => fetchMovies(true)}
          disabled={loading || seeding}
          className="btn-secondary self-stretch md:self-auto gap-2 text-xs font-semibold py-2.5 px-4 z-10"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Database
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left/Middle: Movies Grid */}
        <div className="lg:col-span-2 space-y-6">
          {/* Genre Filters & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface-900/40 border border-surface-800/80 backdrop-blur-md">
            <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(g)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                    selectedGenre === g
                      ? 'bg-brand-600/20 text-brand-400 border-brand-500/40'
                      : 'text-surface-400 hover:text-white border-transparent hover:bg-surface-800/60'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {movies.length === 0 && !loading && (
              <button
                onClick={handleSeedDatabase}
                disabled={seeding}
                className="btn-primary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5"
              >
                {seeding ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Seed Default Movies
              </button>
            )}
          </div>

          {/* Loader or Error states */}
          {loading && (
            <div className="flex flex-col items-center justify-center p-20 glass-card">
              <RefreshCw className="w-10 h-10 text-brand-500 animate-spin mb-4" />
              <p className="text-sm text-surface-400">Querying PostgreSQL database...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 shadow-lg">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Connection Alert</h4>
                <p className="text-xs text-red-400/90 leading-relaxed">{error}</p>
                <div className="pt-2 text-[10px] text-surface-400">
                  Tip: Make sure to start the Firebase emulator in terminal: <code className="bg-surface-950 px-1 py-0.5 rounded text-brand-400">firebase emulators:start</code>
                </div>
              </div>
            </div>
          )}

          {/* Movies List */}
          {!loading && !error && (
            <>
              {filteredMovies.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 glass-card text-center space-y-4">
                  <Film className="w-12 h-12 text-surface-600" />
                  <div>
                    <h3 className="text-base font-bold text-white">No Movies Found</h3>
                    <p className="text-xs text-surface-400 mt-1 max-w-sm">
                      {selectedGenre !== 'All' 
                        ? `No movies listed under the "${selectedGenre}" genre.` 
                        : 'Your local database is empty. Click the seed button above to auto-populate movies.'}
                    </p>
                  </div>
                  {selectedGenre === 'All' && (
                    <button
                      onClick={handleSeedDatabase}
                      disabled={seeding}
                      className="btn-primary py-2 px-4 text-xs font-semibold"
                    >
                      {seeding ? 'Seeding...' : 'Seed Movies now'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMovies.map((movie) => {
                    const avgRating = getAverageRating(movie);
                    const isSelected = selectedMovie?.id === movie.id;
                    return (
                      <div
                        key={movie.id}
                        onClick={() => setSelectedMovie(movie)}
                        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${
                          isSelected
                            ? 'bg-surface-900 border-brand-500/80 ring-2 ring-brand-500/20 shadow-2xl'
                            : 'bg-surface-900/60 border-surface-850 hover:bg-surface-900/90 hover:border-surface-700/80 shadow-md'
                        }`}
                      >
                        {/* Movie Card Content */}
                        <div>
                          <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-950">
                            <img
                              src={movie.imageUrl}
                              alt={movie.title}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-transparent to-transparent"></div>
                            <span className="absolute bottom-3 left-3 px-2 py-0.5 text-[10px] font-extrabold uppercase bg-brand-600/35 border border-brand-500/40 text-brand-300 rounded-lg backdrop-blur-md">
                              {movie.genre}
                            </span>
                            {avgRating && (
                              <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-950/70 border border-amber-500/30 text-amber-400 font-extrabold text-[11px] backdrop-blur-md">
                                <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                                <span>{avgRating}</span>
                              </div>
                            )}
                          </div>

                          <div className="p-4 space-y-2">
                            <h3 className="text-base font-extrabold text-white leading-tight group-hover:text-brand-400 transition-colors">
                              {movie.title}
                            </h3>
                            
                            {/* Reviews list peek */}
                            <div className="space-y-2 pt-2 border-t border-surface-800/60">
                              <span className="text-[10px] font-bold text-surface-450 uppercase tracking-widest block">
                                Reviews ({movie.reviews_on_movie?.length || 0})
                              </span>
                              
                              {movie.reviews_on_movie && movie.reviews_on_movie.length > 0 ? (
                                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                  {movie.reviews_on_movie.slice(0, 2).map((rev, idx) => (
                                    <div key={idx} className="p-2 rounded-xl bg-surface-950/40 border border-surface-850 text-xs">
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-surface-300 truncate max-w-[120px]">
                                          @{rev.user?.username || 'user'}
                                        </span>
                                        <div className="flex items-center text-amber-400 scale-90 origin-right">
                                          {Array.from({ length: 5 }).map((_, i) => (
                                            <Star
                                              key={i}
                                              className={`w-3 h-3 shrink-0 ${
                                                i < (rev.rating || 0) ? 'fill-current' : 'opacity-20'
                                              }`}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                      <p className="text-surface-400 line-clamp-2 leading-relaxed">
                                        {rev.reviewText}
                                      </p>
                                    </div>
                                  ))}
                                  {movie.reviews_on_movie.length > 2 && (
                                    <span className="text-[10px] text-brand-500 font-semibold hover:underline block text-right pt-1">
                                      + {movie.reviews_on_movie.length - 2} more reviews
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-surface-500 italic py-1">No reviews yet. Be the first to write one!</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 pt-0 border-t border-transparent">
                          <span className="text-xs text-brand-400 font-semibold group-hover:underline flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {isSelected ? 'Viewing Review Panel' : 'Write a Review'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Review Details and Submission panel */}
        <div className="lg:col-span-1">
          {selectedMovie ? (
            <div className="glass-card p-6 space-y-6 sticky top-24 border-brand-500/20">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <span className="text-[10px] uppercase font-black text-brand-400 tracking-widest block">
                    Review Center
                  </span>
                  <h2 className="text-lg font-black text-white truncate max-w-[200px]" title={selectedMovie.title}>
                    {selectedMovie.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedMovie(null)}
                  className="btn-ghost py-1 px-2 text-[11px]"
                >
                  Clear Selection
                </button>
              </div>

              {/* Form Block */}
              {user ? (
                <form onSubmit={handleSubmitReview} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-surface-300">Your Rating</label>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const index = i + 1;
                        const active = hoverRating !== null ? index <= hoverRating : index <= rating;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setRating(index)}
                            onMouseEnter={() => setHoverRating(index)}
                            onMouseLeave={() => setHoverRating(null)}
                            className="p-1 text-amber-400 transition-all hover:scale-110 focus:outline-none"
                            aria-label={`Rate ${index} Stars`}
                          >
                            <Star className={`w-7 h-7 shrink-0 ${active ? 'fill-current' : 'opacity-20'}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="review-text" className="text-xs font-bold text-surface-300">
                      Your Review
                    </label>
                    <textarea
                      id="review-text"
                      rows={4}
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Write your rating review... what did you think of the plot, characters, cinematography?"
                      required
                      className="input-field min-h-[100px] resize-none"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReview || !reviewText.trim()}
                    className="btn-primary w-full py-3"
                  >
                    {submittingReview ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Submitting review...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Submit Review to Postgres
                      </>
                    )}
                  </button>

                  {reviewSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      Review saved successfully to PostgreSQL!
                    </div>
                  )}
                </form>
              ) : (
                <div className="p-4 rounded-2xl bg-surface-950/60 border border-surface-800 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Authentication Required</h4>
                    <p className="text-xs text-surface-450 mt-1">
                      To comply with SQL Connect security rule directives, reviews require user authentication.
                    </p>
                  </div>
                  <div className="text-xs text-surface-400 italic">
                    Tip: Please log in using the regular CRM credentials.
                  </div>
                </div>
              )}

              {/* Extra technical connection detail box */}
              <div className="p-3.5 bg-surface-950/40 border border-surface-850 rounded-2xl text-[11px] text-surface-400 space-y-1.5">
                <span className="font-extrabold uppercase text-surface-300 tracking-wider block">
                  GraphQL operation logs
                </span>
                <p className="leading-relaxed">
                  Query: <code className="text-brand-400">ListMovies</code>
                </p>
                <p className="leading-relaxed">
                  Mutation: <code className="text-brand-400">AddReview</code>
                </p>
                <p className="leading-relaxed">
                  Security rules: <code className="text-brand-400">@auth(level: USER)</code> validated securely on emulator port 9399.
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card p-6 text-center space-y-4 border-dashed border-surface-750">
              <Film className="w-12 h-12 text-surface-650 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-white">No Selection</h3>
                <p className="text-xs text-surface-450 mt-1 max-w-xs mx-auto">
                  Select any movie card on the left to write a review or inspect full ratings.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlConnectDemoPage;
